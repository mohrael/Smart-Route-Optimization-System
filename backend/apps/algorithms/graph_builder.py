import osmnx as ox


def load_and_plot_cairo():
    try:
        ox.settings.use_cache = True
        ox.settings.timeout = 180
        G = ox.graph_from_place("Cairo, Egypt", network_type='drive')
        return G
    except Exception as e:
        print(f"Error loading street network: {e}")
        return None


def build_graph(G):
    """Build adjacency dict from OSM graph for Dijkstra."""
    graph = {}
    for u, v, data in G.edges(data=True):
        weight = data.get("length", 1)
        if u not in graph:
            graph[u] = []
        if v not in graph:
            graph[v] = []
        graph[u].append((v, weight))
        graph[v].append((u, weight))
    return graph