"""
utils.py — routing helpers.

Key changes vs original:
  - optimize_route: early-exits immediately when a destination group has no node
    inside the SCC instead of iterating over all candidates first.
  - Removed the misleading "standard standard standard" comment noise.
  - improve_path / calculate_cost kept but marked as unused in the current pipeline
    (they require the legacy Dijkstra wrapper, not the nx-based cache).
  - haversine_distance is unchanged.
"""

import math
import networkx as nx
from ..algorithms.cache import cached_shortest_path


# ── haversine ─────────────────────────────────────────────────────────────────

def haversine_distance(lat1, lon1, lat2, lon2, unit="km") -> float | None:
    try:
        if not all(isinstance(v, (int, float)) for v in [lat1, lon1, lat2, lon2]):
            raise ValueError("Coordinates must be numbers")
        if not (-90 <= lat1 <= 90 and -90 <= lat2 <= 90):
            raise ValueError("Invalid latitude")
        if not (-180 <= lon1 <= 180 and -180 <= lon2 <= 180):
            raise ValueError("Invalid longitude")

        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        radius_map = {"km": 6371.0, "miles": 3958.8, "meters": 6371000.0}
        if unit not in radius_map:
            raise ValueError("Invalid unit. Choose 'km', 'miles', or 'meters'.")

        return radius_map[unit] * c
    except Exception as e:
        print(f"haversine_distance error: {e}")
        return None


# ── greedy multi-stop routing ─────────────────────────────────────────────────

def optimize_route(
    G,
    start_nodes: list[int],
    dest_nodes_list: list[list[int]],
    strongly_connected: frozenset,
) -> tuple[list[int] | None, float | None]:
    """
    Greedy nearest-node routing with early-exit heuristics:
      1. Pick the first reachable node from start_nodes.
      2. For each destination group, find the cheapest reachable node from current position.
      3. Stitch paths together, skipping the bridge node to avoid duplication.
      4. Early exit if cost is 0 or if a destination has no reachable nodes.

    Returns (full_path_osm_ids, total_cost_meters) or (None, None) on failure.
    """
    source_node = next((n for n in start_nodes if n in strongly_connected), None)
    if source_node is None:
        return None, None

    full_path: list[int] = []
    total_cost: float = 0.0
    current_node = source_node

    for dest_group in dest_nodes_list:
        reachable = [c for c in dest_group if c in strongly_connected]
        if not reachable:
            return None, None

        best_cost = float("inf")
        best_path: list[int] | None = None

        for candidate in reachable:
            cost, path = cached_shortest_path(G, current_node, candidate)

            if cost < best_cost:
                best_cost = cost
                best_path = path

            if best_cost == 0:
                break

        if best_path is None:
            return None, None

        if not full_path:
            full_path.extend(best_path)
        else:
            full_path.extend(best_path[1:])

        total_cost += best_cost
        current_node = best_path[-1]

    return full_path, total_cost


# ── legacy helpers (unused in main pipeline but kept for compatibility) ────────

def improve_path(path, algorithm):
    """2-opt local search over a path using a legacy Dijkstra wrapper."""
    best_path = path[:]
    best_cost = calculate_cost(best_path, algorithm)

    for i in range(1, len(path) - 1):
        for j in range(i + 1, len(path)):
            new_path = path[:]
            new_path[i:j] = reversed(new_path[i:j])
            new_cost = calculate_cost(new_path, algorithm)
            if new_cost < best_cost:
                best_cost = new_cost
                best_path = new_path

    return best_path


def calculate_cost(path, algorithm) -> float:
    total = 0.0
    for i in range(len(path) - 1):
        _, cost = algorithm.shortest_path(path[i], path[i + 1])
        total += cost
    return total