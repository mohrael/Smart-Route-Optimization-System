from django.db import models

class Location(models.Model):
    name = models.CharField(max_length=50)
    latitude = models.FloatField()
    longitude = models.FloatField()

    def __str__(self):
        return self.name

class Edge(models.Model):
    from_location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="edges_from")
    to_location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="edges_to")
    cost = models.FloatField()

    def __str__(self):
        return f"{self.from_location} -> {self.to_location}"
