from core.mongo import db
from datetime import datetime, timezone

def save_favorite(user_id, location):
    collection = db['favorites']

    document = {
        "user_id": str(user_id),
        "location":{
            "name":location.get("name"),
            "lat":location.get("lat"),
            "lon":location.get("lon"),
        },
        "created_at": datetime.now(timezone.utc)
    }


    collection.insert_one(document)