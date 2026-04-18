# -*- coding: utf-8 -*-
"""Token bucket rate limiter for the yfinance service."""

import time
from threading import Lock


# Rate limiting: 1800 requests per hour
RATE_LIMIT_REQUESTS = 1800
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds


class TokenBucketRateLimiter:
    """Token bucket rate limiter for yfinance API calls."""

    def __init__(self, rate: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW) -> None:
        self.rate: int = rate
        self.window: int = window
        self.tokens: float = float(rate)
        self.last_refill: float = time.time()
        self.lock: Lock = Lock()

    def acquire(self) -> bool:
        """Acquire a token, returning True if allowed."""
        with self.lock:
            now: float = time.time()
            elapsed: float = now - self.last_refill

            # Refill tokens based on elapsed time
            refill: float = (elapsed / self.window) * self.rate
            self.tokens = min(float(self.rate), self.tokens + refill)
            self.last_refill = now

            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False

    def wait_time(self) -> float:
        """Return seconds to wait until next token available."""
        with self.lock:
            if self.tokens >= 1:
                return 0.0
            needed: float = 1.0 - self.tokens
            return (needed / self.rate) * self.window
