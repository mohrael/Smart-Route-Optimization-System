from ...algorithms.snap_service import map_location_to_node
# from ...algorithms.graph_builder import build_graph
# from ...algorithms.dijkstra import Dijkstra
from ...algorithms.utils import optimize_route


class RouteService:
    def __init__(self, G):
        self.G = G

    def run_from_nodes(self,start_node:int,dest_node:list[int]):
        try:
            path, cost = optimize_route(self.G,start_node,dest_node)
        except Exception as e:
            print(f"Routing error: {e}")
            return None,None
        
        return path,cost

    def run(self, start_location, destination_locations):
        """
        Snap DB locations to nearest OSM nodes, then run Dijkstra.
        Returns (path_as_osm_node_ids, total_cost_in_meters)
        """
        try:
            start_node, dest_nodes = map_location_to_node(
                self.G, start_location, destination_locations
            )
        except Exception as e:
            print(f"Snapping error: {e}")
            return None, None

        return self.run_from_nodes(start_node,dest_nodes)