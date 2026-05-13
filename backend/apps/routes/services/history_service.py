# handles business logic

from core.mongo import db
from datetime import datetime, timezone

def save_route_history(
    user_id,
    start_location,
    destinations,
    total_distance,
    road_path,
    directions,
):
    stops = len(destinations)
    distance_km = round(total_distance / 1000, 2) if total_distance else 0

    collection = db["route_history"]

    document = {
        "user_id": str(user_id),

        "timestamp": datetime.now(timezone.utc),

        "start_location":start_location,
        "destinations":destinations,
        "road_path":road_path,

        "directions":directions,

        "stats":{
            "total_distance_km":distance_km,
            "stops":stops,
        },


    }

    collection.insert_one(document)