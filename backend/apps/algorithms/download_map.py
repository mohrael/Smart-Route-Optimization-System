import osmnx as ox

print("🌍 Downloading Cairo street network... (This might take a minute)")
G = ox.graph_from_place("Cairo, Egypt", network_type='drive')

print("💾 Saving to local file...")
ox.save_graphml(G, "cairo_graph.graphml")

print("✅ Map saved successfully as cairo_graph.graphml!")
