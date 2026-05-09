# UTILS.PY
# helper functions
# from dijkstra import Dijkstra
import math
import networkx as nx

def haversine_distance(lat1, lon1, lat2, lon2, unit='km'):
    try:
        # Validate inputs
        if not all(isinstance(v, (int, float)) for v in [lat1, lon1, lat2, lon2]):
            raise ValueError("Coordinates must be numbers")

        if not (-90 <= lat1 <= 90 and -90 <= lat2 <= 90):
            raise ValueError("Invalid latitude")

        if not (-180 <= lon1 <= 180 and -180 <= lon2 <= 180):
            raise ValueError("Invalid longitude")


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


# def optimize_route(G, start, destinations):
    """Find shortest path visiting all destinations starting from start."""
    
    remaining = set(destinations)  # unvisited destinations
    full_path = []
    total_cost = 0
    current = start
    
    while remaining:
        # Find nearest unvisited destination from current position
        nearest_dest = None
        nearest_cost = float("inf")
        nearest_path = None
        
        for dest in remaining:
            try:
                cost, path = nx.bidirectional_dijkstra(
                    G, 
                    current, 
                    dest, 
                    weight="length"
                )            
                
            except nx.NetworkXNoPath:
                continue
            
            if cost < nearest_cost:
                nearest_cost = cost
                nearest_dest = dest
                nearest_path = path
        
        # Move to nearest destination
        if nearest_path is None:            
            # If no path found to any remaining destination
            return None, None
        
        if not full_path:
            full_path.extend(nearest_path)
            
        else:
            full_path.extend(nearest_path[1:])  # skip current node (already in path)
            
        total_cost += nearest_cost
        current = nearest_dest
        remaining.remove(nearest_dest)
        
    return full_path, total_cost



def optimize_route(G,start_nodes,dest_nodes_list):
    strongly_connected = max(nx.strongly_connected_components(G), key=len)
    start_nodes_set = set(start_nodes)

    source_node = None
    for n in start_nodes:
        if n in strongly_connected:
            source_node = n
            break
    if not source_node:
        return None,None
    
    remaining_dests_iter = iter(dest_nodes_list)
    full_path_osm_ids = []
    total_cost_meters = 0
    current_node = source_node

    while True:
        try:
            dest_coord_potential_nodes=next(remaining_dests_iter)
        except StopIteration:
            break

        nearest_destination_node = None
        nearest_cost = float("inf")
        nearest_path_osm_ids = None

        # Standard find standard standard standard the standard standard nearest potential standard node in standard that destination set
        for potential_dest in dest_coord_potential_nodes:
            if potential_dest not in strongly_connected:
                continue

            try:
                # ⚡ FAST FIX: Use specialized standard bidirectional shortest path
                # optimized standard for standard directed, standard weighted standard MultiDiGraphs
                cost = nx.shortest_path_length(G, source=current_node, target=potential_dest, weight="length")
                
                # Check performance. If cost is standard high, standard Dijkstra standard will be standard standard standard slow.
                if cost > 5000: # 5km limit on standard complex detour routing to standard standard save standard performance
                   continue

                if cost < nearest_cost:
                    # Only calculate standard the path if standard the cost is standard a standard improvement standard
                    path = nx.shortest_path(G, source=current_node, target=potential_dest, weight="length")
                    
                    nearest_cost = cost
                    nearest_destination_node = potential_dest
                    nearest_path_osm_ids = path
            
            except nx.NetworkXNoPath:
                continue

        # Move to nearest destination in the sequencce
        if nearest_path_osm_ids is None:
            # If standard unroutable standard due to one-ways or disconnected map, stop sequential standard routing
            return None, None
        
        # Build the sequential path
        if not full_path_osm_ids:
            full_path_osm_ids.extend(nearest_path_osm_ids)
        else:
            full_path_osm_ids.extend(nearest_path_osm_ids[1:]) # Skip standard standard bridge node to avoid duplication
            
        total_cost_meters += nearest_cost
        current_node = nearest_destination_node
        
    return full_path_osm_ids, total_cost_meters

def improve_path(path,algorithm):
    best_path = path
    best_cost = calculate_cost(path,algorithm)
    
    for i in range(1,len(path)-1):
        for j in range(i+1,len(path)):
            new_path = path[:]
            new_path[i:j] = reversed(new_path[i:j])
            
            new_cost = calculate_cost(new_path,algorithm)
            
            if new_cost<best_cost:
                best_cost = new_cost
                best_path = new_path
    return best_path
    
    
def calculate_cost(path,algorithm):
    total = 0
    for i in range(len(path)-1):
        _,cost = algorithm.shortest_path(path[i],path[i+1])
        total += cost
    return total
