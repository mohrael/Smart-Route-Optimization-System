from django.apps import AppConfig


class RoutesConfig(AppConfig):
    name = 'apps.routes'
    
    def ready(self):
        """App initialization - lazy load graph and algorithm on first request."""
        # Graph and algorithm are initialized lazily in views.py
    # from ..algorithms.graph_builder import build_graph
    #     from ..algorithms.dijkstra import Dijkstra
    #     from . import views
        
    #     # Build graph and algorithm once
    #     views.GRAPH = build_graph()
    #     views.ALGORITHM = Dijkstra(views.GRAPH)
