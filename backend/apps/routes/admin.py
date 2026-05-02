from django.contrib import admin
from .models import RouteRequest, RouteRequestDestination, RouteResult

admin.site.register(RouteRequest)
admin.site.register(RouteRequestDestination)
admin.site.register(RouteResult)
