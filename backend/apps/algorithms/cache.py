import networkx as nx
import threading
import time
from core.mongo import db

routing_cache = db["routing_cache"]

_l1_cache = {}
_l1_lock = threading.RLock()
_scc_cache = {}
_batch_queue = []
_batch_lock = threading.Lock()
_batch_timer = None

_hits = 0
_misses = 0
_stats_lock = threading.Lock()

def cached_shortest_path(G, source, target):
    source, target = int(source), int(target)
    key = (source, target)

    global _hits, _misses

    with _l1_lock:
        if key in _l1_cache:
            with _stats_lock:
                _hits += 1
            return _l1_cache[key]

    with _stats_lock:
        _misses += 1

    try:
        cost, path = nx.single_source_dijkstra(G, source, target, weight="length")
        result = (cost, path)
    except nx.NetworkXNoPath:
        result = (float('inf'), None)

    with _l1_lock:
        _l1_cache[key] = result

    _enqueue_batch_write(source, target, result[0], result[1])

    return result


def _enqueue_batch_write(s, t, cost, path):
    with _batch_lock:
        _batch_queue.append({"s": s, "t": t, "c": cost, "p": path})
        if len(_batch_queue) >= 100:
            _flush_batch()


def _flush_batch():
    global _batch_timer
    if not _batch_queue:
        return

    try:
        routing_cache.insert_many(_batch_queue, ordered=False)
    except Exception:
        pass

    _batch_queue.clear()
    if _batch_timer:
        _batch_timer.cancel()
    _batch_timer = None


def _schedule_batch_flush():
    global _batch_timer
    if _batch_timer:
        return

    def flush_task():
        with _batch_lock:
            _flush_batch()

    _batch_timer = threading.Timer(5.0, flush_task)
    _batch_timer.daemon = True
    _batch_timer.start()


def connectedGraph(G):
    gid = id(G)
    if gid not in _scc_cache:
        _scc_cache[gid] = frozenset(
            max(nx.strongly_connected_components(G), key=len)
        )
    return _scc_cache[gid]


def cache_info() -> dict:
    with _stats_lock:
        total = _hits + _misses
    return {
        "l1_cache_size": len(_l1_cache),
        "batch_queue_size": len(_batch_queue),
        "hits": _hits,
        "misses": _misses,
        "hit_rate": round(_hits / total, 3) if total else 0.0,
        "scc_graphs_cached": len(_scc_cache),
    }


def clear_path_cache():
    global _l1_cache, _batch_queue, _batch_timer
    with _l1_lock:
        _l1_cache.clear()
    with _batch_lock:
        _batch_queue.clear()
        if _batch_timer:
            _batch_timer.cancel()
            _batch_timer = None
    _scc_cache.clear()
