from django.urls import path
from .views import RouteRequestView,RouteResultView

urlpatterns = [
    path('optimize-route/', RouteRequestView.as_view()),
    path('my-routes/', RouteRequestView.as_view()),
    path('location_path/<int:pk>/', RouteResultView.as_view()),
    
]
