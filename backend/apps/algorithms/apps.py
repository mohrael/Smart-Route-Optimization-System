from django.apps import AppConfig
import os


class AlgorithmsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.algorithms'

    def ready(self):
        # RUN_MAIN == 'true' means we ARE in the main process (not the reloader)
        if os.environ.get('RUN_MAIN') == 'true':
            try:
                from .engine import _initialize_graph_and_algorithm
                _initialize_graph_and_algorithm()
                print("Street network graph loaded successfully.")
            except Exception as e:
                print(f"Failed to load street network graph: {e}")