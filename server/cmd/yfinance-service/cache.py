# -*- coding: utf-8 -*-
"""Thread-safe in-memory cache with TTL support for the yfinance service."""

import time
from threading import Lock
from typing import Any, Optional


# TTL constants in seconds
TTL_PRICE = 60       # 60 seconds for prices
TTL_HISTORY = 300    # 5 minutes for history
TTL_INFO = 86400     # 24 hours for info


class CacheEntry:
    """Cache entry with TTL."""

    def __init__(self, value: Any, ttl: int) -> None:
        self.value = value
        self.expires_at: float = time.time() + ttl

    def is_expired(self) -> bool:
        return time.time() > self.expires_at


class InMemoryCache:
    """Thread-safe in-memory cache with TTL support and bounded memory footprint."""

    def __init__(self, max_entries: int = 2000) -> None:
        self._cache: dict[str, CacheEntry] = {}
        self._lock: Lock = Lock()
        self._max_entries: int = max_entries
        self._last_sweep: float = time.time()

    def _sweep_expired(self, now: float) -> None:
        """Remove all expired entries from cache."""
        expired_keys = [k for k, v in self._cache.items() if now > v.expires_at]
        for k in expired_keys:
            self._cache.pop(k, None)

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            if entry.is_expired():
                del self._cache[key]
                return None
            return entry.value

    def set(self, key: str, value: Any, ttl: int) -> None:
        """Set value in cache with TTL and enforce bounds."""
        now = time.time()
        with self._lock:
            # Periodically sweep expired keys every 60 seconds or when full
            if now - self._last_sweep > 60 or len(self._cache) >= self._max_entries:
                self._sweep_expired(now)
                self._last_sweep = now

            # If still exceeding capacity after sweeping expired keys, remove oldest keys
            if len(self._cache) >= self._max_entries:
                excess = len(self._cache) - self._max_entries + 1
                for _ in range(excess):
                    if self._cache:
                        oldest_key = next(iter(self._cache))
                        self._cache.pop(oldest_key, None)

            self._cache[key] = CacheEntry(value, ttl)

    def invalidate(self, key: str) -> None:
        """Remove key from cache."""
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()

