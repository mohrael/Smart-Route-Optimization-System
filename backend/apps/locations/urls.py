from django.urls import path
from .views import LocationView

urlpatterns = [
    path('get_locations/', LocationView.as_view()),
    
]