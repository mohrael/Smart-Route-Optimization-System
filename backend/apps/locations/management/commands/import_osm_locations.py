from django.core.management.base import BaseCommand
from apps.locations.models import Location
import json

class Command(BaseCommand):
    help = "Import locations from OpenStreetMap JSON"
    
    def handle(self, *args, **options):
        file_path = "egypt_locations.json"
        
        with open(file_path,"r",encoding="utf-8") as f:
            data = json.load(f)
        
        count = 0
        
        for element in data["elements"]:
            name = element.get("tags",{}).get("name")
            lat = element.get("lat")
            lon = element.get("lon")
            
            if name and lat and lon:
                Location.objects.get_or_create(
                    name=name,
                    latitude=lat,
                    longitude=lon
                )
                count+=1
        self.stdout.write(self.style.SUCCESS(f"Imported {count} locations"))