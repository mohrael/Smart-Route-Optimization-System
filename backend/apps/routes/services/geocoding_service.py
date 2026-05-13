from core.mongo import db
import requests
from datetime import datetime

def get_coordinates(query):
    collection = db["geo_cache"]
    query = query.lower().strip()

    # 1.search mongoDB first
    cached_result = collection.find_one({"query":query})

    if cached_result:
        print("--- Cache Hit! Returning data from MongoDB ---")
        return cached_result["location"]
    
    # 2. if not in mongo, call the external api
    print("--- Cache Miss! Calling Nominatim API ---")
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"

    response = requests.get(
        url,
        headers={
            "User-Agent":"SmartRouteSystem/1.0"
        }
    )
    results = response.json()
    if not results:
        return None

    data = results[0]

    location_data={
        "name":data["display_name"],
        "lat": float(data["lat"]),
        "lon": float(data["lon"])
    }

    # 3.save to mongoDB for next time
    collection.insert_one({
        "query":query,
        "location":location_data,
        "created_at": datetime.now()
    })

    return location_data



# from django.http import JsonResponse
# from django.views.decorators.csrf import csrf_exempt
# import json

# # Import the service you created
# from .services.history_service import save_route_history 

# @csrf_exempt # Only if you haven't set up CSRF tokens for your React frontend yet
# def save_route(request):
#     if request.method == "POST":
#         try:
#             # 1. Parse the data from React
#             data = json.loads(request.body)
            
#             # 2. Extract specific fields
#             # Why: This ensures we don't pass 'trash' data to our service
#             user_id = data.get("user_id")
#             start = data.get("start_location")
#             destinations = data.get("destinations")
#             distance = data.get("total_distance")
#             path = data.get("road_path")
#             directions = data.get("directions")

#             # 3. Call your NoSQL Service
#             # Why: The View doesn't need to know HOW MongoDB works. 
#             # It just trusts the service to do it.
#             save_route_history(
#                 user_id=user_id,
#                 start_location=start,
#                 destinations=destinations,
#                 total_distance=distance,
#                 road_path=path,
#                 directions=directions
#             )

#             # 4. Success Response
#             return JsonResponse({"status": "success", "message": "Route saved to history"}, status=201)

#         except Exception as e:
#             # Why: Good developers always catch errors so the app doesn't crash
#             return JsonResponse({"status": "error", "message": str(e)}, status=400)

#     return JsonResponse({"status": "error", "message": "Only POST allowed"}, status=405)