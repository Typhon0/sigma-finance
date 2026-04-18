"""Pytest fixtures for yfinance-service gRPC integration tests.

Provides an in-process gRPC server that uses mocked yfinance data
so tests run without network access or a real yfinance API key.
"""

import os
import sys
import time
import logging
from unittest.mock import MagicMock, patch
from concurrent import futures

import grpc
import pytest
import pandas as pd

# Ensure the service package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from proto import market_data_pb2, market_data_pb2_grpc
from servicer import MarketDataServicer


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers to build realistic mock yfinance data
# ---------------------------------------------------------------------------

def _make_mock_fast_info(
    last_price: float = 150.0,
    last_volume: int = 1_000_000,
    day_high: float = 152.0,
    day_low: float = 148.0,
    previous_close: float = 149.0,
):
    """Return a MagicMock that quacks like yf.Ticker.fast_info."""
    fast = MagicMock()
    fast.last_price = last_price
    fast.last_volume = last_volume
    fast.day_high = day_high
    fast.day_low = day_low
    fast.previous_close = previous_close
    return fast


def _make_mock_info(
    long_name: str = "Test Corp",
    short_name: str = "Test",
    exchange: str = "NMS",
    sector: str = "Technology",
    industry: str = "Software",
    currency: str = "USD",
    timezone: str = "America/New_York",
    market_cap: int = 1_000_000_000_000,
    trailing_pe: float = 25.5,
    dividend_yield: float = 0.006,
    beta: float = 1.1,
    shares_outstanding: int = 10_000_000_000,
    total_revenue: int = 400_000_000_000,
    ebitda: int = 130_000_000_000,
    total_debt: int = 120_000_000_000,
    eps_trailing_year: float = 6.0,
    fifty_two_week_high: float = 199.99,
    fifty_two_week_low: float = 124.17,
    bid: float = 149.90,
    ask: float = 150.10,
    long_business_summary: str = "A test company summary.",
):
    """Return a dict that mimics yf.Ticker.info for a stock."""
    return {
        "longName": long_name,
        "shortName": short_name,
        "exchange": exchange,
        "sector": sector,
        "industry": industry,
        "currency": currency,
        "timezone": timezone,
        "marketCap": market_cap,
        "trailingPE": trailing_pe,
        "dividendYield": dividend_yield,
        "beta": beta,
        "sharesOutstanding": shares_outstanding,
        "totalRevenue": total_revenue,
        "ebitda": ebitda,
        "totalDebt": total_debt,
        "epsTrailingYear": eps_trailing_year,
        "fiftyTwoWeekHigh": fifty_two_week_high,
        "fiftyTwoWeekLow": fifty_two_week_low,
        "bid": bid,
        "ask": ask,
        "longBusinessSummary": long_business_summary,
    }


def _make_mock_history_df():
    """Return a small DataFrame that mimics yf.Ticker.history() output."""
    import pandas as pd
    import numpy as np

    dates = pd.date_range(end=pd.Timestamp.now(), periods=5, freq="1D")
    df = pd.DataFrame(
        {
            "Open": [148.0, 149.0, 150.0, 151.0, 152.0],
            "High": [149.0, 150.5, 151.5, 152.5, 153.0],
            "Low": [147.0, 148.5, 149.5, 150.5, 151.0],
            "Close": [148.5, 150.0, 151.0, 152.0, 152.5],
            "Volume": [800000, 900000, 1100000, 950000, 1050000],
        },
        index=dates,
    )
    df.index.name = "Date"
    return df


# Symbols that should simulate unknown/invalid tickers (yfinance returns no data)
UNKNOWN_SYMBOLS = {"ZZZZZ", "INVALID_TICKER", "NONEXISTENT", "ZZZZZ-USD"}


def _make_empty_ticker():
    """Return a MagicMock that simulates yfinance returning no data for an unknown symbol."""
    ticker = MagicMock()
    # fast_info with zero/None values — simulates unknown ticker
    fast = MagicMock()
    fast.last_price = None
    fast.last_volume = None
    fast.day_high = None
    fast.day_low = None
    fast.previous_close = None
    ticker.fast_info = fast
    # info returns an empty dict — yfinance does this for invalid tickers
    ticker.info = {}
    # history returns an empty DataFrame
    import pandas as pd
    ticker.history.return_value = pd.DataFrame()
    return ticker


def _make_normal_ticker():
    """Return a MagicMock with full mock data for a valid ticker."""
    ticker_instance = MagicMock()
    ticker_instance.fast_info = _make_mock_fast_info()
    ticker_instance.info = _make_mock_info()
    ticker_instance.history.return_value = _make_mock_history_df()
    return ticker_instance


def _make_search_quotes(query: str):
    normalized = query.strip().upper()
    if normalized == "MIXED":
        return [
            {
                "symbol": "AAPL",
                "longname": "Apple Inc.",
                "exchDisp": "NASDAQ",
                "exchange": "NMS",
                "quoteType": "EQUITY",
                "currency": "USD",
                "country": "US",
            },
            {
                "symbol": "^GSPC",
                "longname": "S&P 500 Index",
                "exchDisp": "INDEX",
                "exchange": "IND",
                "quoteType": "INDEX",
            },
            {
                "symbol": "QQQ",
                "longname": "Invesco QQQ Trust",
                "exchDisp": "NASDAQ",
                "exchange": "NMS",
                "quoteType": "ETF",
                "currency": "USD",
                "country": "US",
            },
        ]
    if normalized == "LOOKUP":
        return []
    if normalized == "EMPTY":
        return []
    return [
        {
            "symbol": "AAPL",
            "longname": "Apple Inc.",
            "exchDisp": "NASDAQ",
            "exchange": "NMS",
            "quoteType": "EQUITY",
            "currency": "USD",
            "country": "US",
        }
    ]


def _make_lookup_frame(rows):
    if not rows:
        return pd.DataFrame()
    frame = pd.DataFrame(rows)
    if "symbol" in frame.columns:
        frame = frame.set_index("symbol")
    return frame


def _make_lookup_results(query: str):
    normalized = query.strip().upper()
    if normalized == "LOOKUP":
        return {
            "stock": _make_lookup_frame([]),
            "etf": _make_lookup_frame([
                {
                    "symbol": "VOO",
                    "longName": "Vanguard S&P 500 ETF",
                    "exchange": "NMS",
                    "currency": "USD",
                    "isin": "US9229083632",
                }
            ]),
            "mutualfund": _make_lookup_frame([
                {
                    "symbol": "VTSAX",
                    "longName": "Vanguard Total Stock Market Index Fund Admiral Shares",
                    "exchange": "NAS",
                    "currency": "USD",
                }
            ]),
        }
    return {
        "stock": _make_lookup_frame([
            {
                "symbol": "AAPL",
                "longName": "Apple Inc.",
                "exchange": "NMS",
                "currency": "USD",
            }
        ]),
        "etf": _make_lookup_frame([]),
        "mutualfund": _make_lookup_frame([]),
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def mock_yfinance():
    """Patch yfinance.Ticker at module scope so all tests share the mock.

    Symbols in UNKNOWN_SYMBOLS return empty data (simulating invalid tickers).
    All other symbols return normal mock data.
    """
    with patch("servicer.yf.Ticker") as mock_ticker_cls, patch("servicer.yf.Search") as mock_search_cls, patch("servicer.yf.Lookup") as mock_lookup_cls:
        def ticker_factory(symbol, **kwargs):
            if symbol in UNKNOWN_SYMBOLS:
                return _make_empty_ticker()
            return _make_normal_ticker()

        mock_ticker_cls.side_effect = ticker_factory
        mock_search_cls.side_effect = lambda query, **kwargs: MagicMock(quotes=_make_search_quotes(query), response={}, all={"quotes": _make_search_quotes(query)}, news=[], lists=[], research=[], nav=[])

        def lookup_factory(query, **kwargs):
            lookup = MagicMock()
            lookup.get_stock.side_effect = lambda count=25: _make_lookup_results(query)["stock"].head(count)
            lookup.get_etf.side_effect = lambda count=25: _make_lookup_results(query)["etf"].head(count)
            lookup.get_mutualfund.side_effect = lambda count=25: _make_lookup_results(query)["mutualfund"].head(count)
            return lookup

        mock_lookup_cls.side_effect = lookup_factory
        mock_ticker_cls.search_mock = mock_search_cls
        mock_ticker_cls.lookup_mock = mock_lookup_cls
        yield mock_ticker_cls


@pytest.fixture(scope="module")
def grpc_server(mock_yfinance):
    """Start an in-process gRPC server for the test module.

    Returns the server so the fixture teardown can stop it.
    """
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
    market_data_pb2_grpc.add_MarketDataServiceServicer_to_server(
        MarketDataServicer(), server
    )
    # Use a random port to avoid conflicts
    port = server.add_insecure_port("[::]:0")
    server.start()
    logger.info("Test gRPC server started on port %d", port)
    yield server, port
    server.stop(grace=1)
    logger.info("Test gRPC server stopped")


@pytest.fixture(scope="module")
def grpc_channel(grpc_server):
    """Return a gRPC channel connected to the in-process test server."""
    _server, port = grpc_server
    channel = grpc.insecure_channel(f"localhost:{port}")
    yield channel
    channel.close()


@pytest.fixture(scope="module")
def grpc_stub(grpc_channel):
    """Return a MarketDataService stub for making gRPC calls."""
    return market_data_pb2_grpc.MarketDataServiceStub(grpc_channel)
