import osmnx as ox


def get_nearest_node(G, lats, lons):
    return int(ox.distance.nearest_nodes(G, X=lons, Y=lats))


def map_location_to_node(G, start_location, destinations):
    lats = [start_location.latitude] + [d.latitude for d in destinations]
    lons = [start_location.longitude] + [d.longitude for d in destinations]
    
    node = get_nearest_node(G, X=lons, Y=lats)

    # if destinations:
    #     lats = [loc.latitude for loc in destinations]
    #     lons = [loc.longitude for loc in destinations]
    #     result = ox.distance.nearest_nodes(G, X=lons, Y=lats)
    #     dest_nodes = [int(n) for n in result]
    # else:
    #     dest_nodes = []
    start_node = node[0]
    dest_nodes = node[1:]
    
    return start_node, dest_nodes