from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RouteRequestSerializer, RouteResultSerializer
from ..locations.models import Location
from .models import RouteRequest, RouteRequestDestination, RouteResult
import time
from datetime import timedelta
from drf_spectacular.utils import extend_schema, OpenApiExample
from rest_framework.permissions import IsAuthenticated
from ..algorithms.engine import _initialize_graph_and_algorithm
# from .services.route_service import RouteService
import osmnx as ox

from ..algorithms.utils import optimize_route


def _snap_coord_to_node(G,lat,lon):
    return int(ox.distance.nearest_nodes(G,X=lon,Y=lat))

def _get_access_nodes_for_coord(G,lat,lon,radius_meters=50):
    north,south,east,west = ox.utils_geo.bbox_from_point((lat,lon),dist=radius_meters)

    potential_nodes = []
    for node_id in G.nodes:
        if 'y' in G.nodes[node_id] and 'x' in G.nodes[node_id]:
            if south <= G.nodes[node_id]['y'] <= north and west <= G.nodes[node_id]['x'] <= east:
               potential_nodes.append(int(node_id))


class RouteRequestView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RouteRequestSerializer

    def post(self, request, *args, **kwargs):
        try:
            G, GRAPH, ALGORITHM = _initialize_graph_and_algorithm()
        except RuntimeError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # service = RouteService(G)
        serializer = RouteRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        start_coord = serializer.validated_data['start_location']   # {lat, lon}
        dest_coords = serializer.validated_data['destinations']      # [{lat, lon}, ...]
        
        try:
            start_nodes = _get_access_nodes_for_coord(G,start_coord['lat'],start_coord['lon'])

            if not start_nodes:
                start_nodes = [_snap_coord_to_node(G, start_coord['lat'], start_coord['lon'])]
           
            dest_nodes_list = [
                _get_access_nodes_for_coord(G,d['lat'],d['lon'])
                for d in dest_coords
            ]
            for i, dest_group in enumerate(dest_nodes_list):
                 if not dest_group:
                     dest_nodes_list[i] = [_snap_coord_to_node(G, dest_coords[i]['lat'], dest_coords[i]['lon'])]
            
        except Exception as e:
            return Response({"error": f"Failed to snap coordinates to graph: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


        # start_id = serializer.validated_data['start_location']
        # destinations_list = serializer.validated_data['destinations']

        # requested_ids = set([start_id] + destinations_list)
        # locations_qs = Location.objects.filter(id__in=requested_ids)
        # all_locations = {loc.id: loc for loc in locations_qs}

        # if start_id not in all_locations:
        #     return Response({"error": "invalid start location"}, status=status.HTTP_400_BAD_REQUEST)

        # start_location = all_locations[start_id]
        # invalid_destinations = set(destinations_list) - set(all_locations.keys())
        # if invalid_destinations:
        #     return Response(
        #         {"error": f"invalid destination location(s): {list(invalid_destinations)}"},
        #         status=status.HTTP_400_BAD_REQUEST
        #     )

        route_request = RouteRequest.objects.create(
            user=request.user,
            start_lat=start_coord['lat'],
            start_lon=start_coord['lon']
        )
        # destination_objects = [all_locations[dest_id] for dest_id in destinations_list]

        RouteRequestDestination.objects.bulk_create([
            RouteRequestDestination(
                route_request=route_request, 
                lat=d['lat'],
                lon=d['lon']
            )
            for d in dest_coords
        ])

        # service = RouteService(G)


        start_time = time.perf_counter()
        path, cost = optimize_route(G,start_nodes, dest_nodes_list)
        execution_time = timedelta(seconds=time.perf_counter() - start_time)

        if path is None or cost is None or cost == float("inf"):
            return Response(
                {"error": "unreachable destination(s) - no valid path found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        route_result = RouteResult.objects.create(
            route_request=route_request,
            total_cost=cost,
            path=path,
            algorithm_used=RouteResult.AlgorithmChoices.DIJKSTRA,
            execution_time=execution_time,
        )

        return Response(RouteResultSerializer(route_result).data, status=status.HTTP_201_CREATED)

    def get(self, request, *args, **kwargs):
        requests = RouteRequest.objects.filter(user=self.request.user)
        result = []
        for req in requests:
            destinations = list(
                RouteRequestDestination.objects.filter(route_request=req)
                .values('lat','lon')
            )
            try:
                res = RouteResult.objects.get(route_request=req)
                result_data = RouteResultSerializer(res).data
            except RouteResult.DoesNotExist:
                result_data = None
            result.append({
                "request_id": req.id,
                "start": {"lat":req.start_lat,"lon":req.start_lon},
                "destinations": destinations,
                "result": result_data
            })
        return Response(result, status=status.HTTP_200_OK)


class RouteResultView(APIView):
    def get(self, request, pk):
        try:
            route_result = RouteResult.objects.get(pk=pk)
        except RouteResult.DoesNotExist:
            return Response({"error": "RouteResult not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            G, _, _ = _initialize_graph_and_algorithm()
        except RuntimeError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        path_ids = route_result.path
        # location_map = {
        #     loc.id: loc
        #     for loc in Location.objects.filter(id__in=path_ids)
        # }

        path_with_coords = []
        for i in range(len(path_ids)):
            try:
                node_id = int(path_ids[i])
            except (TypeError, ValueError):
                continue

            if node_id in G.nodes:
                path_with_coords.append({
                    "latitude": G.nodes[node_id]['y'],
                    "longitude": G.nodes[node_id]['x']
                })

                # node_data = G.nodes[node_id]
                
                # lat = node_data.get("y")
                # lon = node_data.get("x")
                
                # if lat is None or lon is None:
                #     continue
                
                # path_with_coords.append({
                #     # "id": node_id,
                #     # "name": node_data.get("name") or f"OSM node {node_id}",
                #     "latitude": lat,
                #     "longitude": lon
                # })
            if i < len(path_ids) - 1:
                next_node_id = int(path_ids[i+1])
                
                if G.has_edge(node_id, next_node_id):
                    # MultiDiGraphs can have multiple parallel roads, get the shortest one
                    edges = G.get_edge_data(node_id, next_node_id)
                    edge_data = min(edges.values(), key=lambda x: x.get('length', float('inf')))

                    # If the road curves, it has a 'geometry' attribute (Shapely LineString)
                    if 'geometry' in edge_data:
                        # Extract all the little curve coordinates (lon, lat)
                        # We use [1:-1] to skip the first and last points so we don't duplicate the intersection nodes
                        for lon, lat in list(edge_data['geometry'].coords)[1:-1]:
                            path_with_coords.append({
                                "latitude": lat,
                                "longitude": lon
                            })
            # elif node_id in location_map:
            #     loc = location_map[node_id]
            #     path_with_coords.append({
            #         "id": loc.id,
            #         "name": loc.name,
            #         "latitude": loc.latitude,
            #         "longitude": loc.longitude
            #     })

        # total_cost is in meters (OSM edge length), convert to km
        distance_km = round(route_result.total_cost / 1000, 2)

        return Response({
            "route_request": route_result.route_request.id,
            "total_distance_km": distance_km,
            "path": path_with_coords
        })