from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RouteRequestSerializer, RouteResultSerializer
from ..locations.models import Location, Edge
from ..algorithms.utils import optimize_route
from .models import RouteRequest, RouteRequestDestination, RouteResult
import time
from datetime import timedelta
from drf_spectacular.utils import extend_schema, OpenApiExample
from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse

# These are lazily initialized on first request
GRAPH = None
ALGORITHM = None


def _initialize_graph_and_algorithm():
    """Lazy initialization of graph and algorithm on first request."""
    global GRAPH, ALGORITHM
    if GRAPH is None or ALGORITHM is None:
        from ..algorithms.graph_builder import build_graph
        from ..algorithms.dijkstra import Dijkstra
        GRAPH = build_graph()
        ALGORITHM = Dijkstra(GRAPH)


class RouteRequestView(APIView): 
    permission_classes = [IsAuthenticated]
    serializer_class = RouteRequestSerializer

    @extend_schema(
        request=RouteRequestSerializer,  # Request body schema
        responses={
            201: RouteResultSerializer,
            400: OpenApiExample(
                'Validation Error',
                summary='Invalid input example',
                value={"name": ["This field is required."]}
            )
        },
        summary="Create a new route request",
        description="This endpoint creates a new route request and returns its details.",
        examples=[
            OpenApiExample(
                'Example Request',
                value={"start_location":2,"destinations":[1,6,7,3]},
                request_only=True 
            ),
            OpenApiExample(
                'Example Response',
                value={
                    "id": 1,
                    "route_request": 1,
                    "total_cost": 51.5,
                    "path": [
                        2,
                        1,
                        2,
                        3,
                        6,
                        7
                    ],
                    "algorithm_used": "DIJKSTRA",
                    "execution_time": "00:00:00.000111"
                }
            )
        ]
    )
    
    
    def post(self, request, *args, **kwargs):
        # Lazy initialize graph and algorithm on first request
        _initialize_graph_and_algorithm()
        
        serializer = RouteRequestSerializer(data=request.data)
        
        if serializer.is_valid():
            start_id = serializer.validated_data['start_location']
            destinations_list = serializer.validated_data['destinations']
            
            # fetch all locations once
            all_locations = {loc.id: loc for loc in Location.objects.all()}
            
            # validate start location
            if start_id not in all_locations:
                return Response(
                    {"error":"invalid start location"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            start_location = all_locations[start_id]
            
            # convert list to set
            destinations_set = set(destinations_list)
            
            # validate all destinations exist before proceeding
            invalid_destinations = destinations_set - set(all_locations.keys())
            if invalid_destinations:
                return Response(
                    {"error": f"invalid destination location(s): {list(invalid_destinations)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # create one RouteRequest
            route_request = RouteRequest.objects.create(user=request.user, start_location=start_location)

            # create multiple RouteRequestDestination rows
            destination_objs = [
                RouteRequestDestination(
                    route_request=route_request,
                    location=all_locations[dest_id]
                )
                for dest_id in destinations_list
            ]
                
            RouteRequestDestination.objects.bulk_create(destination_objs)
            
            start_time = time.perf_counter()
            # run algorithm (using pre-built graph and algorithm)
            path, cost = optimize_route(ALGORITHM, GRAPH, start_location.id, destinations_list)
            
           
            end_time = time.perf_counter()
            execution_time = timedelta(seconds=end_time - start_time)
            
            
             # check if path was found
            if path is None or cost == float("inf"):
                return Response(
                    {"error": "unreachable destination(s) - no valid path found"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            route_result = RouteResult.objects.create(
                route_request=route_request,
                total_cost=cost,
                path = path,
                algorithm_used=RouteResult.AlgorithmChoices.DIJKSTRA,
                execution_time=execution_time,
            )
            
            route_result_serializer = RouteResultSerializer(route_result)
            return Response(route_result_serializer.data, status=status.HTTP_201_CREATED)
            # return Response(
            #     {
            #         "request_id": route_request.id,
            #         "path" : path,
            #         "cost": cost,
            #         "execution time": execution_time,
            #         "destinations": destinations_list
            #     },
            #     status= status.HTTP_201_CREATED
            # )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    
    def get(self, request, *args, **kwargs):
        requests = RouteRequest.objects.filter(user=self.request.user)

        result = []
        for req in requests:
            destinations = list(
                RouteRequestDestination.objects.filter(route_request=req)
                .values_list("location_id", flat=True)
            )
            try:
                res = RouteResult.objects.get(route_request=req)
                result_data = RouteResultSerializer(res).data
            except RouteResult.DoesNotExist:
                result_data = None
            result.append({
                "request_id":req.id,
                "start_location": req.start_location.id,
                "destinations":destinations,
                "result": result_data
            })
        return Response(result, status=status.HTTP_200_OK)


class RouteResultView(APIView):
    def get(self, request, pk):
        try:
            route_result = RouteResult.objects.get(pk=pk)
            path_ids = route_result.path

            locations = Location.objects.filter(id__in=path_ids)

            loc_map = {
                loc.id: {
                    "id": loc.id,
                    "name": loc.name,
                    "latitude": loc.latitude,
                    "longitude": loc.longitude
                }
                for loc in locations
            }

            path_with_coords = [loc_map[loc_id] for loc_id in path_ids]

            return Response({
                "route_request": route_result.route_request.id,
                "total_distance_km": round(route_result.total_cost,2),
                # "total_cost": route_result.total_cost,
                "path": path_with_coords
            })

        except RouteResult.DoesNotExist:
            return Response(
                {"error": "RouteResult not found"},
                status=status.HTTP_404_NOT_FOUND
            )