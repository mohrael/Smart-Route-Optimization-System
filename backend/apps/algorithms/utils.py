# helper functions
# from dijkstra import Dijkstra
import math

def haversine_distance(lat1, lon1, lat2, lon2, unit='km'):
    """
    Calculate the great-circle distance between two points on Earth using the Haversine formula.

    Parameters:
        lat1, lon1: Latitude and Longitude of point 1 in decimal degrees
        lat2, lon2: Latitude and Longitude of point 2 in decimal degrees
        unit: 'km' for kilometers, 'miles' for miles, 'meters' for meters

    Returns:
        Distance between the two points in the specified unit.
    """
    try:
        # Validate inputs
        for val in (lat1, lon1, lat2, lon2):
            if not isinstance(val, (int, float)):
                raise ValueError("Latitude and longitude must be numbers.")
        if not (-90 <= lat1 <= 90 and -90 <= lat2 <= 90):
            raise ValueError("Latitude must be between -90 and 90 degrees.")
        if not (-180 <= lon1 <= 180 and -180 <= lon2 <= 180):
            raise ValueError("Longitude must be between -180 and 180 degrees.")

        # Convert decimal degrees to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        # Earth radius in different units
        radius_map = {
            'km': 6371.0,
            'miles': 3958.8,
            'meters': 6371000.0
        }
        if unit not in radius_map:
            raise ValueError("Invalid unit. Choose 'km', 'miles', or 'meters'.")

        distance = radius_map[unit] * c
        return distance

    except Exception as e:
        print(f"Error: {e}")
        return None


def optimize_route(algorithm, graph, start, destinations):
    """Find shortest path visiting all destinations starting from start.
    
    Args:
        algorithm: Dijkstra instance
        graph: graph dict
        start: starting node ID
        destinations: list of destination node IDs to visit
    """
    remaining = set(destinations)  # unvisited destinations
    full_path = [start]
    total_cost = 0
    current = start
    
    while remaining:
        # Find nearest unvisited destination from current position
        nearest_dest = None
        nearest_cost = float("inf")
        nearest_path = None
        
        for dest in remaining:
            path, cost = algorithm.shortest_path(current, dest)
            if cost < nearest_cost:
                nearest_cost = cost
                nearest_dest = dest
                nearest_path = path
        
        # Move to nearest destination
        if nearest_path:
            full_path.extend(nearest_path[1:])  # skip current node (already in path)
            total_cost += nearest_cost
            current = nearest_dest
            remaining.remove(nearest_dest)
        else:
            # If no path found to any remaining destination
            return None, None
    
    # print("Full path:", full_path)
    # print("Total cost:", total_cost)
    return full_path, total_cost

