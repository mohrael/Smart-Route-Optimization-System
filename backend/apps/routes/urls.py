from django.urls import path
from .views import RouteRequestView,RouteResultView,search_location,route_history,add_favorites,get_favorites,remove_favorite

urlpatterns = [
    path('optimize-route/', RouteRequestView.as_view()),
    path('my-routes/', RouteRequestView.as_view()),
    path('location_path/<int:pk>/', RouteResultView.as_view()),
    path('search-location/',search_location),
    path('history/',route_history),
    path('favorites/add/',add_favorites),
    path('favorites/',get_favorites),
    path('favorites/remove/',remove_favorite),
]
