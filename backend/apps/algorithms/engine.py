import os
import osmnx as ox
from .graph_builder import load_and_plot_cairo
from .graph_builder import build_graph

G = None
GRAPH = None  # adjacency dict for Dijkstra
ALGORITHM = None

def _initialize_graph_and_algorithm():
    global G, GRAPH, ALGORITHM

    if G is not None:
        return G, GRAPH, ALGORITHM

    graph_path = os.path.join(os.path.dirname(__file__), "cairo_graph.graphml")

    if os.path.exists(graph_path):
        try:
            G = ox.load_graphml(graph_path)
        except Exception as e:
            G=load_and_plot_cairo()
    else:
        G = load_and_plot_cairo()
        if G is None:
            raise RuntimeError("street network graph could not be loaded")
        try:
            ox.save_graphml(G, graph_path)
        except Exception as exc:
            print(f"Could not save graph cache: {exc}")

    # G = load_and_plot_cairo()
    GRAPH = build_graph(G)

    return G, GRAPH, ALGORITHM