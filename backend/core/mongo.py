from pymongo import MongoClient

# Added tlsAllowInvalidCertificates=true to the MongoDB connection string to skip SSL verification for local development
MONGO_URI = "mongodb+srv://mohrealrafet_db_user:mohra246@smart-route-cluster.kyd1c1m.mongodb.net/?appName=smart-route-cluster&tlsAllowInvalidCertificates=true"

client = MongoClient(MONGO_URI)

db = client["smart_route_system"]