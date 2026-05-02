
from rest_framework import serializers
from .models import Location,Edge

class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = '__all__'
    