"""
RegIQ — backend/app/rag/cache.py
In-Memory TTL Query Cache for RegIQ Regulatory Q&A.

Features:
- Sub-millisecond response for repeated SME regulatory queries.
- Configurable TTL (default 1 hour = 3600s).
- Capacity management with oldest-entry eviction (default 1,000 entries).
- Safe isolation: public queries are shared; Pro user custom-workspace queries
  are segregated by user_id so private data is never leaked across tenants.
- Thread-safe using threading Lock.
- Metrics & observability (hits, misses, evictions, active size).
"""

from collections import OrderedDict
import hashlib
import threading
import time
from typing import Any, Dict, Optional, Tuple
from loguru import logger


class QueryCache:
    """Thread-safe In-Memory LRU Cache with Time-To-Live (TTL) expiration."""

    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        self.max_size = max_size
        self.default_ttl = default_ttl
        # OrderedDict stores: key -> (cached_value, expire_timestamp)
        self._cache: OrderedDict[str, Tuple[Dict[str, Any], float]] = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0
        self._evictions = 0

    @staticmethod
    def _generate_key(query: str, mode: str, user_id: Optional[str] = None, is_custom_doc: bool = False) -> str:
        """
        Generates a deterministic cache key.
        If is_custom_doc is True, the user_id is baked into the key to isolate tenant workspaces.
        """
        norm_query = " ".join(query.strip().lower().split())
        norm_mode = mode.strip().lower()
        tenant_scope = user_id if (is_custom_doc and user_id) else "public_regulatory"
        raw_key = f"{norm_query}::{norm_mode}::{tenant_scope}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def get(
        self,
        query: str,
        mode: str,
        user_id: Optional[str] = None,
        is_custom_doc: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves a cached answer if present and not expired.
        Returns None on miss or expiration.
        """
        key = self._generate_key(query, mode, user_id, is_custom_doc)
        now = time.time()

        with self._lock:
            if key in self._cache:
                value, expire_at = self._cache[key]
                if now < expire_at:
                    # Cache hit: mark as most recently used
                    self._cache.move_to_end(key)
                    self._hits += 1
                    logger.debug(f"[cache] HIT for query='{query[:40]}...' (TTL remaining: {int(expire_at - now)}s)")
                    return value
                else:
                    # Expired: remove
                    del self._cache[key]
                    self._evictions += 1

            self._misses += 1
            return None

    def set(
        self,
        query: str,
        mode: str,
        value: Dict[str, Any],
        user_id: Optional[str] = None,
        is_custom_doc: bool = False,
        ttl: Optional[int] = None
    ) -> None:
        """Stores an answer in the cache with the specified or default TTL."""
        key = self._generate_key(query, mode, user_id, is_custom_doc)
        effective_ttl = ttl if ttl is not None else self.default_ttl
        expire_at = time.time() + effective_ttl

        with self._lock:
            if key in self._cache:
                del self._cache[key]
            elif len(self._cache) >= self.max_size:
                # Evict oldest entry (FIFO / LRU)
                self._cache.popitem(last=False)
                self._evictions += 1

            self._cache[key] = (value, expire_at)
            logger.debug(f"[cache] STORED query='{query[:40]}...' (entries: {len(self._cache)}, TTL: {effective_ttl}s)")

    def clear(self) -> None:
        """Flushes the entire cache."""
        with self._lock:
            self._cache.clear()
            logger.info("[cache] Flushed all entries.")

    def get_stats(self) -> Dict[str, Any]:
        """Returns cache telemetry and statistics."""
        with self._lock:
            now = time.time()
            active_entries = sum(1 for _, exp in self._cache.values() if now < exp)
            total_lookups = self._hits + self._misses
            hit_ratio = round((self._hits / total_lookups * 100), 2) if total_lookups > 0 else 0.0

            return {
                "active_entries": active_entries,
                "total_stored": len(self._cache),
                "max_size": self.max_size,
                "default_ttl_seconds": self.default_ttl,
                "hits": self._hits,
                "misses": self._misses,
                "hit_ratio_percent": hit_ratio,
                "evictions": self._evictions,
            }


# Global singleton instance
query_cache = QueryCache(max_size=1000, default_ttl=3600)
