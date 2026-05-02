from rest_framework import serializers
from .models import RouteRequest, RouteResult


class RouteRequestSerializer(serializers.Serializer):
    start_location = serializers.IntegerField()
    destinations = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1)


class RouteResultSerializer(serializers.ModelSerializer):
    total_distance_km = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        source='total_cost', 
        read_only=True
    )
    class Meta:
        model = RouteResult
        fields = ['id', 'route_request', 'total_distance_km', 'path', 'algorithm_used', 'execution_time']
   

# class RouteRequestDestinationSerializer(serializers.Serializer):
#     route_request = 


    