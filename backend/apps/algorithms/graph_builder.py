import os
import sys

try:
    from .dijkstra import Dijkstra
    from .utils import optimize_route
except ImportError:
    # Allows running this file directly: python backend/apps/algorithms/graph_builder.py
    from dijkstra import Dijkstra
    from utils import optimize_route

def _load_models():
    """Load Django models for both normal imports and direct script execution."""
    try:
        from apps.locations.models import Edge, Location
        return Location, Edge
    except Exception:
        django_root = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )
        if django_root not in sys.path:
            sys.path.insert(0, django_root)

        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

        import django

        django.setup()
        from apps.locations.models import Edge, Location

        return Location, Edge



def build_graph():
    Location, Edge = _load_models()
    graph = {}

    # STEP 1: Add all nodes (locations)
    locations = Location.objects.all()
    for loc in locations:
        graph[loc.id] = []

    # STEP 2: Add edges (undirected graph)
    edges = Edge.objects.all()

    for edge in edges:
        from_id = edge.from_location.id
        to_id = edge.to_location.id
        cost = edge.cost

        # from → to
        graph[from_id].append((to_id, cost))

        # to → from (undirected)
        graph[to_id].append((from_id, cost))

    return graph


def main(start, end):
    graph = build_graph()
    algorithm = Dijkstra(graph)
    path, cost = optimize_route(algorithm, graph, start, end)
    return path, cost


if __name__ == "__main__":
    main(2, [1, 3, 6, 7])
    # print("Path:", path)
    # print("Cost:", cost)