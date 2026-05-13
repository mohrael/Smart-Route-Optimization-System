from rest_framework import serializers
from .models import RouteResult


class LocationCoordSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lon = serializers.FloatField()

class RouteRequestSerializer(serializers.Serializer):
    start_location = LocationCoordSerializer()
    destinations = serializers.ListField(child=LocationCoordSerializer(), min_length=1)
    algorithm = serializers.ChoiceField(choices=["GREEDY","TSP"], default= "TSP")

class RouteResultSerializer(serializers.ModelSerializer):
    total_distance_km = serializers.SerializerMethodField()

    def get_total_distance_km(self, obj):
        return round(obj.total_cost / 1000, 2)

    class Meta:
        model = RouteResult
        fields = ['id', 'route_request', 'total_distance_km', 'path', 'algorithm_used', 'execution_time']
   

# class RouteRequestDestinationSerializer(serializers.Serializer):
#     route_request = 


    
