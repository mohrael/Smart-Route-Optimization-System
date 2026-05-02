# shortest path logic
from heapq import heapify, heappop, heappush


class Dijkstra:
    def __init__(self, graph):
        self.graph = graph

    def __dijakstra_algorithm(self, start, target):
        distances = {node: float("inf") for node in self.graph}
        distances[start] = 0
        parents = {node: None for node in self.graph}

        pq = [(0, start)]
        heapify(pq)

        while pq:
            curr_dist, curr_node = heappop(pq)

            # Ignore stale queue entries after a better path was found.
            if curr_dist > distances[curr_node]:
                continue

            if curr_node == target:
                break

            for neigh, weight in self.graph[curr_node]:
                dist = curr_dist + weight
                if dist < distances[neigh]:
                    distances[neigh] = dist
                    parents[neigh] = curr_node
                    heappush(pq, (dist, neigh))

        return distances[target], parents

    def __reconstruct_path(self, parents, start, end):
        if end not in parents:
            return None

        path = []
        curr = end
        while curr is not None:
            path.append(curr)
            curr = parents[curr]

        path.reverse()

        if path[0] != start:
            return None
        return path

    def shortest_path(self, start, end):
        if start not in self.graph or end not in self.graph:
            return None, float("inf")

        cost, parents = self.__dijakstra_algorithm(start, end)

        path = self.__reconstruct_path(parents, start, end)
        if path is None:
            return None, float("inf")

        return path, cost