from pymongo import MongoClient

MONGO_URI = "mongodb+srv://mohrealrafet_db_user:mohra246@smart-route-cluster.kyd1c1m.mongodb.net/?appName=smart-route-cluster"

client = MongoClient(MONGO_URI)

db = client["smart_route_system"]