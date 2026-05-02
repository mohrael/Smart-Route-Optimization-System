from rest_framework.views import APIView
from .serializers import LocationSerializer
from rest_framework.response import Response
from rest_framework import status
from .models import Location

class LocationView(APIView):
    
    def get(self,request):
        locations = Location.objects.all()
        serializer = LocationSerializer(locations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
