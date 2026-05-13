from core.mongo import db
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from .serializers import RouteRequestSerializer, RouteResultSerializer
from .models import RouteRequest, RouteRequestDestination, RouteResult
import time
from datetime import timedelta
from rest_framework.permissions import IsAuthenticated
from ..algorithms.engine import _initialize_graph_and_algorithm
import osmnx as ox
from ..algorithms.utils import optimize_route
from .services.geocoding_service import get_coordinates
from .services.history_service import save_route_history
from ..algorithms.tsp_optimizer import optimize_route_tsp
from ..algorithms.cache import connectedGraph, cache_info, cached_shortest_path
import requests as http_requests
from django.db import close_old_connections
import threading

def _fetch_osrm_route(start_coord, dest_coords):
    """ Fetch road path + directions from OSRM """
    try:
        coords = [start_coord] + dest_coords
        coord_str = ';'.join(f"{c['lon']},{c['lat']}" for c in coords)
        url = f"https://router.project-osrm.org/route/v1/driving/{coord_str}?overview=full&geometries=geojson&steps=true"
        res = http_requests.get(url,timeout=10)
        data = res.json()

        if data.get('code') != 'Ok' or not data.get('routes'):
            return [],[]
        
        # road path as [[lat,lon],...]
        road_path = [
            [lat,lon]
            for lon,lat in data['routes'][0]['geometry']['coordinates']
        ]

        steps = [step for leg in data['routes'][0]['legs'] for step in leg['steps']]
        directions = []
        for i, step in enumerate(steps):
            maneuver = step.get('maneuver',{})
            action = f"Turn {maneuver.get('modifier','')}" if maneuver.get('type') == 'turn' else maneuver.get('type','')
            road = f"onto {step['name']}" if step.get('name') else 'ahead'
            dist = f"{step['distance'] / 1000:.1f} km" if step['distance'] > 1000 else f"{int(step['distance'])} m"
            text = f"{action} {road}".strip()
            if text and 'arrive' not in text:
                directions.append({'id': i, 'text': text, 'dist': dist})
        return road_path,directions

    except Exception as e:
        print(f"OSRM fetch failed: {e}")
        return [], []

    
def _snap_coord_to_node(G,lat,lon):
    return int(ox.distance.nearest_nodes(G,X=lon,Y=lat))

def _get_access_nodes_for_coord(
    G, lat: float, lon: float, radius_meters: float = 50, max_candidates: int = 8
) -> list[int]:
    north, south, east, west = ox.utils_geo.bbox_from_point((lat, lon), dist=radius_meters)
    candidates = []
    for node_id, data in G.nodes(data=True):
        if "y" not in data or "x" not in data:
            continue
        if not (south <= data["y"] <= north and west <= data["x"] <= east):
            continue
        dy = data["y"] - lat
        dx = data["x"] - lon
        candidates.append((dy * dy + dx * dx, int(node_id)))

    if not candidates:
        return []

    candidates.sort(key=lambda item: item[0])
    return [node_id for _, node_id in candidates[:max_candidates]]

def _save_history_async(*, user_id, start_location, destinations, total_distance, road_path, directions=[]):
    """Fire-and-forget: fetch OSRM + save route history on a daemon thread so the HTTP
    response is returned immediately without waiting."""

    def _worker():
        close_old_connections()
        try:
            road_path_data, directions_data = _fetch_osrm_route(start_location, destinations)
            save_route_history(
                user_id=user_id,
                start_location=start_location,
                destinations=destinations,
                total_distance=total_distance,
                road_path=road_path_data,
                directions=directions_data,
            )
        except Exception as exc:
            print(f"[history_async] Failed to fetch OSRM/save: {exc}")

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


@api_view(['Get'])
def search_location(request):
    query = request.GET.get("q")

    if not query:
        return Response(
            {"error":"Query is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    
    location = get_coordinates(query)

    if not location:
        return Response(
            {"error":"Location not found"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(location)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def route_history(request):
    user_id = str(request.user.id)

    collection = db["route_history"]

    data = list(
        collection.find({"user_id":user_id}).sort("timestamp",-1).limit(30)
    )

    for d in data:
        d["_id"] = str(d["_id"])
        d["timestamp"] = str(d["timestamp"])

    return Response(data)


@api_view(["GET"])
def cache_diagnostics(request):
    """Dev/ops endpoint — returns path-cache hit rate and size."""
    return Response(cache_info())




class RouteRequestView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RouteRequestSerializer

    def post(self, request, *args, **kwargs):
        # ── 1. Load graph 
        try:
            G, GRAPH, ALGORITHM = _initialize_graph_and_algorithm()
        except RuntimeError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # 2. validate input 
        serializer = RouteRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        start_coord = serializer.validated_data['start_location']   # {lat, lon}
        dest_coords = serializer.validated_data['destinations']      # [{lat, lon}, ...]
        selected_algorithm = serializer.validated_data['algorithm']
        
        # 3. Snap coordinates -> OSM nodes (parallel)
        try:
            def snap_coord(lat, lon):
                nodes = _get_access_nodes_for_coord(G, lat, lon)
                return nodes if nodes else [_snap_coord_to_node(G, lat, lon)]

            from concurrent.futures import ThreadPoolExecutor, as_completed

            all_coords = [(start_coord['lat'], start_coord['lon'])] + [(d['lat'], d['lon']) for d in dest_coords]
            snap_results = {}

            with ThreadPoolExecutor(max_workers=8) as executor:
                futures = {executor.submit(snap_coord, lat, lon): i for i, (lat, lon) in enumerate(all_coords)}
                for future in as_completed(futures):
                    idx = futures[future]
                    snap_results[idx] = future.result()

            start_nodes = snap_results[0]
            dest_nodes_list = [snap_results[i+1] for i in range(len(dest_coords))]
        except Exception as e:
            return Response({"error": f"Failed to snap coordinates to graph: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        
        # 4. persist the request
        route_request = RouteRequest.objects.create(
            user=request.user,
            start_lat=start_coord['lat'],
            start_lon=start_coord['lon']
        )

        RouteRequestDestination.objects.bulk_create([
            RouteRequestDestination(
                route_request=route_request, 
                lat=d['lat'],
                lon=d['lon']
            )
            for d in dest_coords
        ])


        # 5. run algorithm
        strongly_connected = connectedGraph(G)
        start_time = time.perf_counter()
        
        if selected_algorithm == "GREEDY":
            path, cost = optimize_route(
                G,
                start_nodes,
                dest_nodes_list,
                strongly_connected
            )

        elif selected_algorithm == "TSP":
            path, cost = optimize_route_tsp(
                G,
                start_nodes,
                dest_nodes_list,
                strongly_connected
            )

        else:
            return Response(
                {"error": "Invalid algorithm"},
                status=status.HTTP_400_BAD_REQUEST
            )


        execution_time = timedelta(seconds=time.perf_counter() - start_time)

        if path is None or cost is None or cost == float("inf"):
            route_request.delete()
            return Response(
                {"error": "unreachable destination(s) - no valid path found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 6. Persist result
        route_result = RouteResult.objects.create(
            route_request=route_request,
            total_cost=cost,
            path=path,
            algorithm_used=(
                RouteResult.AlgorithmChoices.TSP_APPROX
                if selected_algorithm == "TSP"
                else RouteResult.AlgorithmChoices.DIJKSTRA
            ),
            execution_time=execution_time,
        )

        road_path, directions = _fetch_osrm_route(start_coord, dest_coords)

        _save_history_async(
            user_id=request.user.id,
            start_location=start_coord,
            destinations=dest_coords,
            total_distance=cost,
            road_path=road_path,
            directions=directions,
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

        # total_cost is in meters (OSM edge length), convert to km
        distance_km = round(route_result.total_cost / 1000, 2)

        return Response({
            "route_request": route_result.route_request.id,
            "total_distance_km": distance_km,
            "path": path_with_coords
        })