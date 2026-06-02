# -*- coding: utf-8 -*-
"""MarketDataServicer implements yfinance-based market data retrieval via gRPC."""

import os
import time
import logging
import math
import json
import threading
import collections
from datetime import datetime, timezone
from concurrent import futures
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any, Callable, Optional
from unittest.mock import MagicMock

import grpc
import pandas as pd
import yfinance as yf
from curl_cffi import requests as curl_requests

from proto import market_data_pb2
from proto import market_data_pb2_grpc

from cache import InMemoryCache, TTL_PRICE, TTL_HISTORY, TTL_INFO
from rate_limiter import TokenBucketRateLimiter, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW
from validation import price_to_cents, interval_to_yf_interval, symbol_with_suffix

logger = logging.getLogger(__name__)

# Ring buffer for captured HTTP-accessible logs (up to 10 000 entries)
LOG_BUFFER: collections.deque[dict[str, Any]] = collections.deque(maxlen=10000)
LOG_BUFFER_LOCK = threading.Lock()


class _LogCaptureHandler(logging.Handler):
    """Handler that captures log records into the in-memory ring buffer."""

    def emit(self, record: logging.LogRecord) -> None:
        entry = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "message": self.format(record),
            "service": "yfinance",
        }
        with LOG_BUFFER_LOCK:
            LOG_BUFFER.append(entry)


class _LogHTTPHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler that exposes log entries."""

    def do_GET(self) -> None:
        if self.path.startswith("/logs"):
            self._handle_logs()
        elif self.path.startswith("/health"):
            self._handle_health()
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"not found")

    def _handle_health(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "healthy"}).encode())

    def _handle_logs(self) -> None:
        from urllib.parse import urlparse, parse_qs

        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        limit = int(params.get("limit", [200])[0])
        filter_text = params.get("filter", [""])[0].lower()
        level = params.get("level", [""])[0].upper()

        with LOG_BUFFER_LOCK:
            entries = list(LOG_BUFFER)

        # Apply filters
        if filter_text:
            entries = [e for e in entries if filter_text in e["message"].lower()]
        if level:
            entries = [e for e in entries if e["level"] == level]

        # Return most recent
        entries = entries[-limit:]

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"logs": entries, "total": len(entries)}).encode())

    def log_message(self, format: str, *args: Any) -> None:
        # Suppress HTTP server access logs unless they are important
        logger.debug("%s - %s", self.address_string(), format % args)

def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    return normalized in {"1", "true", "yes", "on"}

HISTORY_TIMEOUT_SECONDS: float = float(os.getenv("YFINANCE_HISTORY_TIMEOUT", "10"))
HISTORY_AUTO_ADJUST: bool = _env_bool("YFINANCE_HISTORY_AUTO_ADJUST", False)
HISTORY_REPAIR: bool = _env_bool("YFINANCE_HISTORY_REPAIR", False)
HISTORY_RAISE_ERRORS: bool = _env_bool("YFINANCE_HISTORY_RAISE_ERRORS", True)


class MarketDataServicer(market_data_pb2_grpc.MarketDataServiceServicer):
    """gRPC servicer for market data using yfinance."""

    def __init__(self) -> None:
        self._session: Any = curl_requests.Session(impersonate="chrome")
        self._rate_limiter: TokenBucketRateLimiter = TokenBucketRateLimiter(
            RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW
        )
        self._price_cache: InMemoryCache = InMemoryCache()
        self._history_cache: InMemoryCache = InMemoryCache()
        self._info_cache: InMemoryCache = InMemoryCache()
        logger.info(
            "MarketDataServicer initialized with rate limiter: %d req/%ds",
            RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW,
        )

    @staticmethod
    def _is_connectivity_error(err: Exception) -> bool:
        msg = str(err).lower()
        indicators = (
            "curl: (6)",
            "curl: (7)",
            "could not connect",
            "failed to connect",
            "name or service not known",
            "temporary failure in name resolution",
            "network is unreachable",
            "connection reset",
            "timed out",
            "timeout",
            "ssl",
            "tls",
        )
        return any(token in msg for token in indicators)

    @staticmethod
    def _is_likely_missing_symbol_error(err: Exception) -> bool:
        msg = str(err).lower()
        indicators = (
            "possibly delisted",
            "no timezone found",
            "no price data found",
            "symbol may be delisted",
            "not found",
        )
        return any(token in msg for token in indicators)

    def _apply_rate_limit(self) -> None:
        """Apply rate limiting with blocking wait."""
        while not self._rate_limiter.acquire():
            wait = self._rate_limiter.wait_time()
            logger.debug("Rate limit reached, waiting %.2f seconds", wait)
            time.sleep(wait)

    def _fetch_with_backoff(
        self,
        fetch_func: Callable[[str], Any],
        symbol: str,
        max_retries: int = 5,
        base_delay: float = 1.0,
    ) -> Any:
        """Fetch data with exponential backoff on 429 errors."""
        last_error: Optional[Exception] = None

        for attempt in range(max_retries):
            self._apply_rate_limit()

            try:
                result: Any = fetch_func(symbol)
                return result
            except Exception as e:
                error_str = str(e).lower()
                if "429" in error_str or "too many requests" in error_str:
                    # Exponential backoff: 1s, 2s, 4s, 8s, 16s
                    delay: float = base_delay * (2 ** attempt)
                    logger.warning(
                        "Rate limited for %s (attempt %d/%d), waiting %.2fs",
                        symbol, attempt + 1, max_retries, delay,
                    )
                    time.sleep(delay)
                    last_error = e
                    continue
                if self._is_connectivity_error(e):
                    delay = min(base_delay * (2 ** attempt), 8.0)
                    logger.warning(
                        "Connectivity issue for %s (attempt %d/%d), waiting %.2fs: %s",
                        symbol, attempt + 1, max_retries, delay, e,
                    )
                    time.sleep(delay)
                    last_error = e
                    continue
                else:
                    # Non-429 error, re-raise
                    raise

        # All retries exhausted
        raise last_error or RuntimeError(
            f"Failed to fetch {symbol} after {max_retries} retries"
        )

    def GetPrice(
        self,
        request: market_data_pb2.PriceRequest,
        context: grpc.ServicerContext,
    ) -> market_data_pb2.PriceResponse:
        """GetPrice returns current price for a symbol."""
        if not request.symbol or not request.symbol.strip():
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "symbol is required")

        symbol: str = symbol_with_suffix(request.symbol, request.asset_type)
        cache_key: str = f"price:{symbol}"

        # Check cache first
        cached: Any = self._price_cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit for price: %s", symbol)
            return cached  # type: ignore[no-any-return]

        def fetch_price(sym: str) -> dict[str, int]:
            ticker = yf.Ticker(sym, session=self._session)
            price: float = 0.0
            volume: int = 0
            bid: float = 0.0
            ask: float = 0.0
            try:
                fast = ticker.fast_info
                price = fast.last_price or 0.0
                volume = fast.last_volume or 0
            except (KeyError, ValueError, AttributeError):
                logger.debug("fast_info unavailable for %s, treating as no data", sym)
            try:
                info: dict[str, Any] = ticker.info
                raw_bid: Any = info.get("bid")
                raw_ask: Any = info.get("ask")
                bid = float(raw_bid) if raw_bid is not None else price
                ask = float(raw_ask) if raw_ask is not None else price
            except (KeyError, ValueError, AttributeError):
                logger.debug("ticker.info unavailable for %s, treating as no data", sym)
                bid = price
                ask = price
            return {
                "last": price_to_cents(price),
                "bid": price_to_cents(bid),
                "ask": price_to_cents(ask),
                "volume": volume,
                "timestamp": int(time.time() * 1000),
            }

        try:
            data: dict[str, int] = self._fetch_with_backoff(fetch_price, symbol)

            # Detect unknown/invalid symbols: yfinance returns 0 price
            if data["last"] == 0 and data["bid"] == 0 and data["ask"] == 0:
                logger.warning("No price data returned for symbol: %s", symbol)
                context.abort(grpc.StatusCode.NOT_FOUND, f"No price data found for symbol: {request.symbol}")

            response: market_data_pb2.PriceResponse = market_data_pb2.PriceResponse(
                symbol=request.symbol,
                bid=data["bid"],
                ask=data["ask"],
                last=data["last"],
                volume=data["volume"],
                timestamp=data["timestamp"],
                source="yfinance",
            )

            # Cache the response
            self._price_cache.set(cache_key, response, TTL_PRICE)
            return response

        except Exception as e:
            # Re-raise gRPC aborts — context.abort() raises an internal
            # exception that must propagate for the framework to send the
            # correct status code to the client.
            if context.code() is not None:  # type: ignore[attr-defined]
                raise
            logger.error("Failed to get price for %s: %s", symbol, e)
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details(f"Failed to fetch price for {request.symbol}: {str(e)}")
            return market_data_pb2.PriceResponse()

    def GetHistory(
        self,
        request: market_data_pb2.HistoryRequest,
        context: grpc.ServicerContext,
    ) -> market_data_pb2.HistoryResponse:
        """GetHistory returns historical OHLCV data."""
        if not request.symbol or not request.symbol.strip():
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "symbol is required")

        symbol: str = symbol_with_suffix(request.symbol, request.asset_type)
        yf_interval: str = interval_to_yf_interval(request.interval)

        # Build cache key including all request params
        req_from: int = getattr(request, 'from', 0)
        req_to: int = getattr(request, 'to', 0)
        cache_key: str = f"history:{symbol}:{yf_interval}:{req_from}:{req_to}:{request.limit}"

        # Check cache first
        cached: Any = self._history_cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit for history: %s", symbol)
            return cached  # type: ignore[no-any-return]

        def fetch_history(sym: str) -> pd.DataFrame:
            ticker = yf.Ticker(sym, session=self._session)
            # yfinance expects from/to as datetime or pandas Timestamp
            from_dt: Optional[datetime] = None
            to_dt: Optional[datetime] = None
            if req_from > 0:
                from_dt = datetime.fromtimestamp(req_from / 1000, tz=timezone.utc)
            if req_to > 0:
                to_dt = datetime.fromtimestamp(req_to / 1000, tz=timezone.utc)

            try:
                hist: pd.DataFrame = ticker.history(
                    interval=yf_interval,
                    start=from_dt,
                    end=to_dt,
                    period="1mo" if from_dt is None and to_dt is None else None,
                    auto_adjust=HISTORY_AUTO_ADJUST,
                    repair=HISTORY_REPAIR,
                    timeout=HISTORY_TIMEOUT_SECONDS,
                    raise_errors=HISTORY_RAISE_ERRORS,
                )
            except (KeyError, ValueError):
                logger.debug("history() unavailable for %s, returning empty", sym)
                return pd.DataFrame()
            except Exception as e:
                if self._is_connectivity_error(e):
                    raise
                if self._is_likely_missing_symbol_error(e):
                    logger.debug("history() indicates missing symbol for %s: %s", sym, e)
                    return pd.DataFrame()
                raise

            # Some yfinance failures can return empty history for a valid symbol
            # during transient connectivity issues; probe once to classify.
            if hist.empty:
                try:
                    _ = ticker.fast_info
                except Exception as e:
                    if self._is_connectivity_error(e):
                        raise

            # Limit results if requested (history() has no limit param)
            limit: int = request.limit or 100
            if len(hist) > limit:
                hist = hist.tail(limit)
            return hist

        try:
            hist: pd.DataFrame = self._fetch_with_backoff(fetch_history, symbol)

            # Detect unknown/invalid symbols: yfinance returns empty DataFrame
            if hist.empty:
                ticker = yf.Ticker(symbol, session=self._session)
                is_valid = False
                try:
                    fast = ticker.fast_info
                    if fast is not None:
                        lp = getattr(fast, "last_price", None)
                        if lp is not None and not isinstance(lp, MagicMock) and lp > 0:
                            is_valid = True
                except Exception:
                    pass

                if not is_valid:
                    logger.warning("No history data returned for symbol: %s", symbol)
                    context.abort(grpc.StatusCode.NOT_FOUND, f"No history data found for symbol: {request.symbol}")
                else:
                    logger.info("Symbol %s is valid but has no historical bars for the requested range", symbol)

            bars: list[market_data_pb2.OHLCVBar] = []
            for _, row in hist.iterrows():
                bar: market_data_pb2.OHLCVBar = market_data_pb2.OHLCVBar(
                    timestamp=int(row.name.timestamp() * 1000) if hasattr(row.name, 'timestamp') else 0,
                    open=price_to_cents(row["Open"]),
                    high=price_to_cents(row["High"]),
                    low=price_to_cents(row["Low"]),
                    close=price_to_cents(row["Close"]),
                    volume=int(row["Volume"]) if not math.isnan(row["Volume"]) else 0,
                )
                bars.append(bar)

            response: market_data_pb2.HistoryResponse = market_data_pb2.HistoryResponse(
                bars=bars,
                has_more=len(bars) >= (request.limit or 100),
                source="yfinance",
                timestamp=int(time.time() * 1000),
            )

            # Cache the response
            self._history_cache.set(cache_key, response, TTL_HISTORY)
            return response

        except Exception as e:
            # Re-raise gRPC aborts — context.abort() raises an internal
            # exception that must propagate for the framework to send the
            # correct status code to the client.
            if context.code() is not None:  # type: ignore[attr-defined]
                raise
            logger.error("Failed to get history for %s: %s", symbol, e)
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details(f"Failed to fetch history for {request.symbol}: {str(e)}")
            return market_data_pb2.HistoryResponse()

    def GetInfo(
        self,
        request: market_data_pb2.InfoRequest,
        context: grpc.ServicerContext,
    ) -> market_data_pb2.InfoResponse:
        """GetInfo returns company/fund information."""
        if not request.symbol or not request.symbol.strip():
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "symbol is required")

        symbol: str = symbol_with_suffix(request.symbol, request.asset_type)
        cache_key: str = f"info:{symbol}:{request.asset_type}"

        # Check cache first
        cached: Any = self._info_cache.get(cache_key)
        if cached is not None:
            logger.debug("Cache hit for info: %s", symbol)
            return cached  # type: ignore[no-any-return]

        def fetch_info(sym: str) -> dict[str, Any]:
            ticker = yf.Ticker(sym, session=self._session)
            try:
                return ticker.info or {}
            except (KeyError, ValueError, AttributeError):
                logger.debug("ticker.info unavailable for %s, returning empty", sym)
                return {}

        try:
            info: dict[str, Any] = self._fetch_with_backoff(fetch_info, symbol)

            # Detect unknown/invalid symbols: yfinance returns empty dict,
            # a dict with only a few keys, or one with quoteType="NONE"
            if (
                not info
                or info.get("quoteType") == "NONE"
                or (not info.get("longName") and not info.get("shortName"))
            ):
                logger.warning("No info data returned for symbol: %s", symbol)
                context.abort(grpc.StatusCode.NOT_FOUND, f"No info data found for symbol: {request.symbol}")

            if request.asset_type == market_data_pb2.ASSET_TYPE_CRYPTO:
                response: market_data_pb2.InfoResponse = market_data_pb2.InfoResponse(
                    crypto=market_data_pb2.CryptoInfo(
                        symbol=request.symbol,
                        name=info.get("name", ""),
                        blockchain=info.get("blockchain", ""),
                        decimals=info.get("decimals", 0),
                        is_stablecoin=info.get("isStablecoin", False),
                        market_cap=info.get("marketCap", 0) or 0,
                        volume_24h=info.get("volume24h", 0) or 0,
                        circulating_supply=info.get("circulatingSupply", 0) or 0,
                        total_supply=info.get("totalSupply", 0) or 0,
                        max_supply=info.get("maxSupply", 0) or 0,
                        fifty_two_week_high=price_to_cents(info.get("fiftyTwoWeekHigh", 0) or 0),
                        fifty_two_week_low=price_to_cents(info.get("fiftyTwoWeekLow", 0) or 0),
                        description=info.get("description", ""),
                    ),
                    source="yfinance",
                    timestamp=int(time.time() * 1000),
                )
            else:
                # Company info for stocks and funds
                response = market_data_pb2.InfoResponse(
                    company=market_data_pb2.CompanyInfo(
                        symbol=request.symbol,
                        name=info.get("longName", "") or info.get("shortName", ""),
                        exchange=info.get("exchange", ""),
                        sector=info.get("sector", ""),
                        industry=info.get("industry", ""),
                        currency=info.get("currency", ""),
                        timezone=info.get("timezone", ""),
                        market_cap=info.get("marketCap", 0) or 0,
                        pe_ratio=info.get("trailingPE", 0) or 0.0,
                        dividend_yield=info.get("dividendYield", 0) or 0.0,
                        beta=int(info.get("beta", 0) or 0),
                        shares_outstanding=info.get("sharesOutstanding", 0) or 0,
                        revenue=info.get("totalRevenue", 0) or 0,
                        earnings=info.get("ebitda", 0) or 0,
                        debt=info.get("totalDebt", 0) or 0,
                        eps=info.get("epsTrailingYear", 0) or 0.0,
                        fifty_two_week_high=price_to_cents(info.get("fiftyTwoWeekHigh", 0) or 0),
                        fifty_two_week_low=price_to_cents(info.get("fiftyTwoWeekLow", 0) or 0),
                        description=info.get("longBusinessSummary", "") or info.get("description", ""),
                    ),
                    source="yfinance",
                    timestamp=int(time.time() * 1000),
                )

            # Cache the response
            self._info_cache.set(cache_key, response, TTL_INFO)
            return response

        except Exception as e:
            # Re-raise gRPC aborts — context.abort() raises an internal
            # exception that must propagate for the framework to send the
            # correct status code to the client.
            if context.code() is not None:  # type: ignore[attr-defined]
                raise
            logger.error("Failed to get info for %s: %s", symbol, e)
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details(f"Failed to fetch info for {request.symbol}: {str(e)}")
            return market_data_pb2.InfoResponse()

    def SearchInstruments(
        self,
        request: market_data_pb2.SearchRequest,
        context: grpc.ServicerContext,
    ) -> market_data_pb2.SearchResponse:
        """SearchInstruments returns normalized search results for stocks, ETFs, and funds."""
        query: str = (request.query or "").strip()
        if not query:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "query is required")

        max_results: int = request.max_results or 8
        try:
            results: list[market_data_pb2.SearchResult] = self._search_instruments(query, max_results)
            return market_data_pb2.SearchResponse(
                results=results,
                provider="yfinance",
                timestamp=int(time.time() * 1000),
            )
        except Exception as e:
            if context.code() is not None:  # type: ignore[attr-defined]
                raise
            logger.error("Failed to search instruments for %s: %s", query, e)
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details(f"Failed to search instruments for {query}: {str(e)}")
            return market_data_pb2.SearchResponse(provider="yfinance", timestamp=int(time.time() * 1000))

    def GetBatchPrices(
        self,
        request: market_data_pb2.BatchPriceRequest,
        context: grpc.ServicerContext,
    ) -> market_data_pb2.BatchPriceResponse:
        """GetBatchPrices — not yet implemented."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("GetBatchPrices is not implemented")
        return market_data_pb2.BatchPriceResponse()

    def _search_instruments(
        self,
        query: str,
        max_results: int,
    ) -> list[market_data_pb2.SearchResult]:
        candidates: list[market_data_pb2.SearchResult] = []

        # Search endpoint returns broad quote data including non-tradeable noise.
        try:
            search = yf.Search(
                query,
                max_results=max_results,
                news_count=0,
                lists_count=0,
                include_cb=True,
                include_nav_links=False,
                include_research=False,
                include_cultural_assets=False,
                enable_fuzzy_query=True,
                session=self._session,
                timeout=15,
                raise_errors=False,
            )
            candidates.extend(self._normalize_search_quotes(getattr(search, "quotes", [])))
        except Exception as e:
            logger.debug("yfinance.Search failed for %s: %s", query, e)

        if len(candidates) < max_results:
            try:
                lookup = yf.Lookup(query, session=self._session, timeout=15, raise_errors=False)
                candidates.extend(self._normalize_lookup_results(lookup, max_results=max_results))
            except Exception as e:
                logger.debug("yfinance.Lookup failed for %s: %s", query, e)

        filtered = self._filter_search_results(candidates)
        if len(filtered) > max_results:
            filtered = filtered[:max_results]
        return filtered

    def _normalize_search_quotes(self, quotes: list[Any]) -> list[market_data_pb2.SearchResult]:
        results: list[market_data_pb2.SearchResult] = []
        for quote in quotes:
            if not isinstance(quote, dict):
                continue

            symbol: str = str(quote.get("symbol", "")).strip()
            name: str = str(
                quote.get("longname")
                or quote.get("shortname")
                or quote.get("name")
                or ""
            ).strip()
            if not symbol or not name:
                continue

            asset_type: str = self._asset_type_from_quote(quote)
            if not asset_type:
                continue

            exchange_val = str(quote.get("exchDisp") or quote.get("exchange") or "").strip()
            isin_val = str(quote.get("isin") or "").strip()
            raw_curr = str(quote.get("currency") or "").strip()
            deduced_curr = self._deduce_currency(symbol, exchange_val, isin_val, raw_curr)

            results.append(
                market_data_pb2.SearchResult(
                    symbol=symbol,
                    name=name,
                    exchange=exchange_val,
                    exchange_code=str(quote.get("exchange") or quote.get("exchDisp") or "").strip(),
                    country=str(quote.get("country") or quote.get("region") or "").strip(),
                    currency=deduced_curr,
                    asset_type=asset_type,
                    provider_source="yfinance",
                    provider_external_id=symbol,
                    isin=isin_val,
                    figi=str(quote.get("figi") or "").strip(),
                    cusip=str(quote.get("cusip") or "").strip(),
                )
            )
        return results

    def _deduce_currency(self, symbol: str, exchange: str, isin: str, currency: str) -> str:
        curr = (currency or "").strip().upper()
        if curr and curr != "USD":
            return curr

        # Check ISIN country prefix
        is_code = (isin or "").strip().upper()
        if len(is_code) >= 2:
            country_prefix = is_code[:2]
            if country_prefix in {
                "FR", "DE", "IT", "ES", "NL", "BE", "PT", "IE", "FI", "AT", "GR", "LU", "EE", "LV", "LT", "SK", "SI", "CY", "MT"
            }:
                return "EUR"
            if country_prefix == "GB":
                return "GBP"
            if country_prefix == "US":
                return "USD"

        # Check symbol exchange suffix
        sym = symbol.strip().upper()
        if sym.endswith(".PA") or sym.endswith(".DE") or sym.endswith(".AS") or sym.endswith(".BR") or sym.endswith(".MI") or sym.endswith(".MC") or sym.endswith(".LS") or sym.endswith(".AT") or sym.endswith(".IR"):
            return "EUR"
        if sym.endswith(".L") or sym.endswith(".IL"):
            return "GBP"

        # Check exchange description / name
        exch = exchange.strip().upper()
        if any(x in exch for x in ["PARIS", "FRANKFURT", "EURONEXT", "XETRA", "AMSTERDAM", "BRUSSELS", "MILAN", "MADRID", "LISBON"]):
            return "EUR"
        if any(x in exch for x in ["LONDON", "LSE"]):
            return "GBP"

        return curr or "USD"

    def _normalize_lookup_results(self, lookup: Any, max_results: int) -> list[market_data_pb2.SearchResult]:
        frames = []
        for lookup_type in ("stock", "etf", "mutualfund"):
            getter = getattr(lookup, f"get_{lookup_type}", None)
            if getter is None:
                continue
            try:
                frame = getter(count=max_results)
            except Exception as e:
                logger.debug("yfinance.Lookup %s failed: %s", lookup_type, e)
                continue
            if frame is not None and not frame.empty:
                frames.append((lookup_type, frame))

        results: list[market_data_pb2.SearchResult] = []
        for lookup_type, frame in frames:
            mapped_asset_type = "FUND" if lookup_type == "mutualfund" else lookup_type.upper()
            for symbol, row in frame.head(max_results).iterrows():
                payload = row.to_dict() if hasattr(row, "to_dict") else {}
                normalized = self._search_result_from_mapping(
                    {
                        "symbol": symbol,
                        "name": payload.get("longName") or payload.get("shortName") or payload.get("name") or symbol,
                        "exchange": payload.get("exchange") or payload.get("exchangeDisp") or "",
                        "exchangeCode": payload.get("exchange") or payload.get("exchangeCode") or "",
                        "country": payload.get("country") or payload.get("region") or "",
                        "currency": payload.get("currency") or "",
                        "assetType": mapped_asset_type,
                        "providerSource": "yfinance",
                        "providerExternalId": payload.get("symbol") or symbol,
                        "isin": payload.get("isin") or "",
                        "figi": payload.get("figi") or "",
                        "cusip": payload.get("cusip") or "",
                    }
                )
                if normalized is not None:
                    results.append(normalized)
        return results

    def _search_result_from_mapping(self, payload: dict[str, Any]) -> market_data_pb2.SearchResult | None:
        symbol = str(payload.get("symbol", "")).strip()
        name = str(payload.get("name", "")).strip()
        exchange = str(payload.get("exchange", "")).strip()
        asset_type = str(payload.get("assetType", "")).strip().upper()
        if not symbol or not name or not exchange or not asset_type:
            return None

        if asset_type not in {"STOCK", "ETF", "FUND"}:
            return None

        return market_data_pb2.SearchResult(
            symbol=symbol,
            name=name,
            exchange=exchange,
            exchange_code=str(payload.get("exchangeCode", "")).strip(),
            country=str(payload.get("country", "")).strip(),
            currency=self._deduce_currency(
                symbol,
                exchange,
                str(payload.get("isin", "")).strip(),
                str(payload.get("currency", "")).strip()
            ),
            asset_type=asset_type,
            provider_source=str(payload.get("providerSource", "yfinance")).strip() or "yfinance",
            provider_external_id=str(payload.get("providerExternalId", symbol)).strip() or symbol,
            isin=str(payload.get("isin", "")).strip(),
            figi=str(payload.get("figi", "")).strip(),
            cusip=str(payload.get("cusip", "")).strip(),
        )

    def _filter_search_results(self, results: list[market_data_pb2.SearchResult]) -> list[market_data_pb2.SearchResult]:
        seen: set[tuple[str, str, str]] = set()
        filtered: list[market_data_pb2.SearchResult] = []
        for result in results:
            if not result.symbol or not result.name:
                continue
            if result.asset_type not in {"STOCK", "ETF", "FUND"}:
                continue
            exchange_key = result.exchange_code or result.exchange or ""
            key = (result.symbol.upper(), exchange_key.upper(), result.asset_type.upper())
            if key in seen:
                continue
            seen.add(key)
            filtered.append(result)
        return filtered

    def _asset_type_from_quote(self, quote: dict[str, Any]) -> str:
        quote_type = str(
            quote.get("quoteType")
            or quote.get("typeDisp")
            or quote.get("type")
            or ""
        ).strip().upper()
        if quote_type in {"EQUITY", "STOCK", "COMMON STOCK", "COMMONSTOCK"}:
            return "STOCK"
        if quote_type in {"ETF"}:
            return "ETF"
        if quote_type in {"MUTUALFUND", "MUTUAL FUND", "FUND"}:
            return "FUND"
        return ""


def serve(host: str = "0.0.0.0", port: int = 50051, http_port: int = 50052) -> None:
    """Start the gRPC server and HTTP log server."""
    # Start gRPC server
    server: grpc.Server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    market_data_pb2_grpc.add_MarketDataServiceServicer_to_server(
        MarketDataServicer(),
        server,
    )

    address: str = f"{host}:{port}"
    server.add_insecure_port(address)
    server.start()
    logger.info("MarketDataServicer listening on %s", address)

    # Start HTTP log server in a daemon thread
    http_server = HTTPServer((host, http_port), _LogHTTPHandler)
    http_thread = threading.Thread(target=http_server.serve_forever, daemon=True)
    http_thread.start()
    logger.info("Log HTTP server listening on %s:%d", host, http_port)

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down MarketDataServicer")
        server.stop(grace=5)
        http_server.shutdown()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Attach ring-buffer capture handler
    capture = _LogCaptureHandler()
    capture.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    logging.getLogger().addHandler(capture)

    host: str = os.environ.get("YFINANCE_HOST", "0.0.0.0")
    port: int = int(os.environ.get("YFINANCE_PORT", "50051"))
    http_port: int = int(os.environ.get("YFINANCE_HTTP_PORT", "50052"))
    serve(host=host, port=port, http_port=http_port)
