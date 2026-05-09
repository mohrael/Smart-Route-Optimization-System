import osmnx as ox

def load_and_plot_cairo():
    try:
        # Configure OSMnx settings
        ox.settings.use_cache = True  # Cache results to avoid repeated downloads
        ox.settings.log_console = True  # Show progress in console

        # Define the place name
        place_name = "Cairo, Egypt"

        # Download the street network for driving (can be 'walk', 'bike', 'all', etc.)
        G = ox.graph_from_place(place_name, network_type='drive')

        # Plot the street network
        ox.plot_graph(G, bgcolor='white', node_size=0, edge_color='black', edge_linewidth=0.5)

        print(f"Street network for {place_name} loaded successfully.")
        return G

    except Exception as e:
        print(f"Error loading street network: {e}")
        return None

if __name__ == "__main__":
    load_and_plot_cairo()
