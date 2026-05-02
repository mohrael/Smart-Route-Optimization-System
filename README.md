# 🚀 Delivery Route Optimizer

A full-stack backend system that calculates the most efficient delivery routes using graph algorithms like Dijkstra.

---

## 🧠 Project Idea

This system solves real-world delivery routing problems by converting locations into a graph and computing optimal paths.

---

## ⚙️ Features

- 📍 Real-world location data (OpenStreetMap)
- 🧭 Graph-based routing system
- ⚡ Dijkstra shortest path algorithm
- 📦 Multi-destination route optimization (greedy approach)
- 🗺️ Interactive map UI (Leaflet)
- 🔐 JWT authentication
- 📡 REST API (Django REST Framework)

---

## 🏗️ Tech Stack

### Backend
- Django
- Django REST Framework
- PostgreSQL / SQLite
- JWT Authentication

### Frontend
- React
- Leaflet (Map visualization)

---

## 🔄 How It Works

1. User selects start + destinations
2. Backend builds graph from database
3. Dijkstra computes shortest paths
4. System optimizes multi-stop route
5. Result is returned and visualized on map

---

## 🧠 Algorithms Used

- Dijkstra Algorithm (Shortest Path)
- Greedy Heuristic (Multi-destination routing)
- (Planned) A* Search

---

## 🚧 Current Status

✅ Core routing system complete  
✅ Real map integration  
🔄 Improving route optimization (2-opt / heuristics)  
🔄 Performance optimization  

---

## 🔥 Future Improvements

- A* algorithm with heuristics
- Traffic-aware routing
- Google Maps API integration
- Caching with Redis
- Background processing (Celery)
- Advanced route optimization (TSP)

---

## 📸 Demo

![alt text](image.png)

---

## 👨‍💻 Author

Rania Raafat