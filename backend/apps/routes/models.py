from django.db import models
from apps.users.models import User
from apps.locations.models import Location
from django.conf import settings


class RouteRequest(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    start_lat = models.FloatField()
    start_lon = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
class RouteRequestDestination(models.Model):
    route_request = models.ForeignKey(RouteRequest, on_delete=models.CASCADE)
    lat = models.FloatField()
    lon = models.FloatField()
    
class RouteResult(models.Model):
    class AlgorithmChoices(models.TextChoices):
        DIJKSTRA = 'DIJKSTRA', 'Dijkstra (Shortest Path)'
        A_STAR = 'A_STAR', 'A* (Heuristic Search)'
        
    route_request = models.OneToOneField(RouteRequest, on_delete=models.CASCADE)
    total_cost = models.FloatField()
    path = models.JSONField(default=list)  # Store path as list of node IDs
    algorithm_used = models.CharField(max_length=8, choices=AlgorithmChoices.choices, default=AlgorithmChoices.DIJKSTRA)
    execution_time = models.DurationField()
    
    


