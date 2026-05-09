from django.core.management.base import BaseCommand
from django.conf import settings
from apps.locations.models import Location
import json

class Command(BaseCommand):
    help = "Import locations from OpenStreetMap JSON"
    
    def handle(self, *args, **options):
        file_path = settings.BASE_DIR / "egypt_locations.json"
        
        with open(file_path,"r",encoding="utf-8") as f:
            data = json.load(f)
        
        count = 0
        
        for element in data.get("elements", []):
            tags = element.get("tags", {})
            center = element.get("center", {})
            name = tags.get("name:en") or tags.get("name")
            lat = element.get("lat", center.get("lat"))
            lon = element.get("lon", center.get("lon"))
            
            if name and lat is not None and lon is not None:
                Location.objects.get_or_create(
                    name=name,
                    latitude=lat,
                    longitude=lon
                )
                count+=1
        self.stdout.write(self.style.SUCCESS(f"Imported {count} locations"))
