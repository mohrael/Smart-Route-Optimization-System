from django.core.management.base import BaseCommand
from apps.locations.models import Location, Edge
from math import sqrt
from apps.algorithms.utils import haversine_distance


def distance(a,b):
    return haversine_distance(a.latitude, a.longitude, b.latitude, b.longitude)
    
class Command(BaseCommand):
    def handle(self, *args, **options):
        
        locations = list(Location.objects.all())
        
        K = 5   # number of connects per node
        
        for loc in locations:
            
            # sort other locations by distance
            nearest = sorted(
                [x for x in locations if x.id != loc.id],
                key=lambda x:distance(loc,x)
            )[:K]
            
            for neighbor in nearest:
                Edge.objects.get_or_create(
                    from_location=loc,
                    to_location=neighbor,
                    cost=distance(loc,neighbor)
                )
        self.stdout.write(self.style.SUCCESS("Edges built successfully"))