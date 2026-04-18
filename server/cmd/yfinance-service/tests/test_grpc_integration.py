"""Integration tests for the yfinance gRPC MarketDataService.

These tests start an in-process gRPC server with mocked yfinance data
and exercise every RPC method through a real gRPC client–server round-trip.
"""

import time

import grpc
import pytest

from proto import market_data_pb2, market_data_pb2_grpc


# ---------------------------------------------------------------------------
# GetPrice
# ---------------------------------------------------------------------------


class TestGetPrice:
    """Integration tests for the GetPrice RPC."""

    def test_get_price_stock(self, grpc_stub, mock_yfinance):
        """GetPrice for a stock symbol returns price data in cents."""
        req = market_data_pb2.PriceRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        resp = grpc_stub.GetPrice(req, timeout=10)

        assert resp.symbol == "AAPL"
        assert resp.last > 0
        assert resp.bid > 0
        assert resp.ask > 0
        assert resp.volume > 0
        assert resp.timestamp > 0
        assert resp.source == "yfinance"

        # Prices are in cents — last_price=150.0 → 15000 cents
        assert resp.last == 15000
        assert resp.bid == 14990
        assert resp.ask == 15010

    def test_get_price_crypto_suffix(self, grpc_stub, mock_yfinance):
        """GetPrice for crypto appends -USD suffix when calling yfinance."""
        req = market_data_pb2.PriceRequest(
            symbol="BTC",
            asset_type=market_data_pb2.ASSET_TYPE_CRYPTO,
        )
        resp = grpc_stub.GetPrice(req, timeout=10)

        # The mock always returns the same data, but we verify the call
        # went through by checking the response fields are populated.
        assert resp.symbol == "BTC"
        assert resp.last > 0
        assert resp.source == "yfinance"

        # Verify yfinance was called with the suffixed symbol
        call_args = mock_yfinance.call_args_list
        # The last call should have "BTC-USD" as the symbol
        assert any("BTC-USD" in str(call) for call in call_args)

    def test_get_price_caching(self, grpc_stub, mock_yfinance):
        """Second GetPrice call for the same symbol should be served from cache."""
        # Reset call count before the test
        mock_yfinance.reset_mock()

        req = market_data_pb2.PriceRequest(
            symbol="MSFT",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )

        # First call — hits yfinance
        resp1 = grpc_stub.GetPrice(req, timeout=10)
        assert resp1.last > 0

        # Second call — should be cached (no new yfinance.Ticker call)
        resp2 = grpc_stub.GetPrice(req, timeout=10)
        assert resp2.last == resp1.last
        assert resp2.timestamp == resp1.timestamp  # Same timestamp = cached

        # yfinance.Ticker should have been called exactly once
        assert mock_yfinance.call_count == 1

    def test_get_price_timestamp_is_recent(self, grpc_stub, mock_yfinance):
        """The timestamp returned for a fresh (uncached) request should be within the last 60 seconds."""
        before = int(time.time() * 1000)
        # Use a unique symbol to avoid cache hits from other tests
        req = market_data_pb2.PriceRequest(
            symbol="FRESH_TIMESTAMP_TEST",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        resp = grpc_stub.GetPrice(req, timeout=10)
        after = int(time.time() * 1000)

        assert before <= resp.timestamp <= after


# ---------------------------------------------------------------------------
# GetHistory
# ---------------------------------------------------------------------------


class TestGetHistory:
    """Integration tests for the GetHistory RPC."""

    def test_get_history_stock_daily(self, grpc_stub, mock_yfinance):
        """GetHistory for a stock with 1D interval returns OHLCV bars."""
        req = market_data_pb2.HistoryRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
            interval=market_data_pb2.INTERVAL_1D,
        )
        resp = grpc_stub.GetHistory(req, timeout=15)

        assert len(resp.bars) > 0
        assert resp.source == "yfinance"
        assert resp.timestamp > 0

        # Verify OHLCV fields on the first bar
        bar = resp.bars[0]
        assert bar.open > 0
        assert bar.high >= bar.open
        assert bar.low <= bar.open
        assert bar.close > 0
        assert bar.volume > 0
        assert bar.timestamp > 0

    def test_get_history_bar_count(self, grpc_stub, mock_yfinance):
        """GetHistory returns the expected number of bars from the mock."""
        req = market_data_pb2.HistoryRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
            interval=market_data_pb2.INTERVAL_1D,
        )
        resp = grpc_stub.GetHistory(req, timeout=15)

        # The mock returns 5 bars
        assert len(resp.bars) == 5

    def test_get_history_caching(self, grpc_stub, mock_yfinance):
        """Second GetHistory call for the same params should be served from cache."""
        mock_yfinance.reset_mock()

        req = market_data_pb2.HistoryRequest(
            symbol="GOOG",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
            interval=market_data_pb2.INTERVAL_1D,
        )

        resp1 = grpc_stub.GetHistory(req, timeout=15)
        resp2 = grpc_stub.GetHistory(req, timeout=15)

        assert len(resp1.bars) == len(resp2.bars)
        assert resp1.timestamp == resp2.timestamp

        # yfinance.Ticker called exactly once
        assert mock_yfinance.call_count == 1

    def test_get_history_limit(self, grpc_stub, mock_yfinance):
        """GetHistory with a limit should truncate results."""
        req = market_data_pb2.HistoryRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
            interval=market_data_pb2.INTERVAL_1D,
            limit=3,
        )
        resp = grpc_stub.GetHistory(req, timeout=15)

        # Mock returns 5 bars; limit=3 should truncate to 3
        assert len(resp.bars) <= 3

    def test_get_history_intervals(self, grpc_stub, mock_yfinance):
        """GetHistory works with various interval types."""
        for interval in [
            market_data_pb2.INTERVAL_1M,
            market_data_pb2.INTERVAL_5M,
            market_data_pb2.INTERVAL_1H,
            market_data_pb2.INTERVAL_1D,
        ]:
            req = market_data_pb2.HistoryRequest(
                symbol="AAPL",
                asset_type=market_data_pb2.ASSET_TYPE_STOCK,
                interval=interval,
            )
            resp = grpc_stub.GetHistory(req, timeout=15)
            assert len(resp.bars) > 0, f"No bars returned for interval {interval}"

    def test_get_history_ohlcv_consistency(self, grpc_stub, mock_yfinance):
        """Each bar should satisfy: low <= open,close <= high."""
        req = market_data_pb2.HistoryRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
            interval=market_data_pb2.INTERVAL_1D,
        )
        resp = grpc_stub.GetHistory(req, timeout=15)

        for bar in resp.bars:
            assert bar.low <= bar.open <= bar.high, (
                f"open={bar.open} not between low={bar.low} and high={bar.high}"
            )
            assert bar.low <= bar.close <= bar.high, (
                f"close={bar.close} not between low={bar.low} and high={bar.high}"
            )


# ---------------------------------------------------------------------------
# GetInfo
# ---------------------------------------------------------------------------


class TestGetInfo:
    """Integration tests for the GetInfo RPC."""

    def test_get_info_stock(self, grpc_stub, mock_yfinance):
        """GetInfo for a stock returns company information."""
        req = market_data_pb2.InfoRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        resp = grpc_stub.GetInfo(req, timeout=10)

        assert resp.source == "yfinance"
        assert resp.timestamp > 0

        # Should return company info (not crypto)
        company = resp.company
        assert company.symbol == "AAPL"
        assert company.name != ""
        assert company.sector != ""
        assert company.industry != ""
        assert company.market_cap > 0

    def test_get_info_company_fields(self, grpc_stub, mock_yfinance):
        """GetInfo returns correct values from the mock data."""
        req = market_data_pb2.InfoRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        resp = grpc_stub.GetInfo(req, timeout=10)

        company = resp.company
        assert company.name == "Test Corp"
        assert company.sector == "Technology"
        assert company.industry == "Software"
        assert company.exchange == "NMS"
        assert company.currency == "USD"
        assert company.timezone == "America/New_York"
        assert company.market_cap == 1_000_000_000_000
        assert company.pe_ratio == pytest.approx(25.5)
        assert company.dividend_yield == pytest.approx(0.006)
        assert company.beta == 1  # beta is cast to int: int(1.1) = 1
        assert company.shares_outstanding == 10_000_000_000
        assert company.eps == pytest.approx(6.0)

    def test_get_info_fifty_two_week_range(self, grpc_stub, mock_yfinance):
        """52-week high/low are returned as cents (price_to_cents)."""
        req = market_data_pb2.InfoRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        resp = grpc_stub.GetInfo(req, timeout=10)

        company = resp.company
        # 199.99 * 100 = 19999, 124.17 * 100 = 12417
        assert company.fifty_two_week_high == 19999
        assert company.fifty_two_week_low == 12417

    def test_get_info_caching(self, grpc_stub, mock_yfinance):
        """Second GetInfo call for the same symbol should be served from cache."""
        mock_yfinance.reset_mock()

        req = market_data_pb2.InfoRequest(
            symbol="MSFT",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )

        resp1 = grpc_stub.GetInfo(req, timeout=10)
        resp2 = grpc_stub.GetInfo(req, timeout=10)

        assert resp1.timestamp == resp2.timestamp
        assert mock_yfinance.call_count == 1

    def test_get_info_description(self, grpc_stub, mock_yfinance):
        """GetInfo returns the long business summary as the description."""
        req = market_data_pb2.InfoRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        resp = grpc_stub.GetInfo(req, timeout=10)

        assert resp.company.description == "A test company summary."


# ---------------------------------------------------------------------------
# SearchInstruments
# ---------------------------------------------------------------------------


class TestSearchInstruments:
    """Integration tests for the SearchInstruments RPC."""

    def test_search_instruments_returns_normalized_quote(self, grpc_stub, mock_yfinance):
        req = market_data_pb2.SearchRequest(query="AAPL", max_results=5)
        resp = grpc_stub.SearchInstruments(req, timeout=10)

        assert resp.provider == "yfinance"
        assert resp.timestamp > 0
        assert len(resp.results) == 1
        result = resp.results[0]
        assert result.symbol == "AAPL"
        assert result.name == "Apple Inc."
        assert result.exchange == "NASDAQ"
        assert result.asset_type == "STOCK"
        assert result.provider_source == "yfinance"

    def test_search_instruments_filters_junk_quotes(self, grpc_stub, mock_yfinance):
        req = market_data_pb2.SearchRequest(query="MIXED", max_results=10)
        resp = grpc_stub.SearchInstruments(req, timeout=10)

        symbols = [result.symbol for result in resp.results]
        assert "AAPL" in symbols
        assert "QQQ" in symbols
        assert "^GSPC" not in symbols
        assert all(result.asset_type in {"STOCK", "ETF", "FUND"} for result in resp.results)

    def test_search_instruments_uses_lookup_fallback(self, grpc_stub, mock_yfinance):
        req = market_data_pb2.SearchRequest(query="LOOKUP", max_results=10)
        resp = grpc_stub.SearchInstruments(req, timeout=10)

        symbols = [result.symbol for result in resp.results]
        assert "VOO" in symbols
        assert "VTSAX" in symbols
        assert all(result.provider_source == "yfinance" for result in resp.results)


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    """Integration tests for error scenarios."""

    def test_get_price_unspecified_asset_type(self, grpc_stub, mock_yfinance):
        """GetPrice with unspecified asset type still returns data (treated as stock)."""
        req = market_data_pb2.PriceRequest(
            symbol="AAPL",
            asset_type=market_data_pb2.ASSET_TYPE_UNSPECIFIED,
        )
        resp = grpc_stub.GetPrice(req, timeout=10)
        # Should not crash — unspecified is treated as stock by symbol_with_suffix
        assert resp.symbol == "AAPL"

    def test_get_price_empty_symbol(self, grpc_stub, mock_yfinance):
        """GetPrice with an empty symbol returns INVALID_ARGUMENT gRPC error."""
        req = market_data_pb2.PriceRequest(
            symbol="",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        with pytest.raises(grpc.RpcError) as exc_info:
            grpc_stub.GetPrice(req, timeout=10)
        assert exc_info.value.code() == grpc.StatusCode.INVALID_ARGUMENT

    def test_get_history_empty_symbol(self, grpc_stub, mock_yfinance):
        """GetHistory with an empty symbol returns INVALID_ARGUMENT gRPC error."""
        req = market_data_pb2.HistoryRequest(
            symbol="",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
            interval=market_data_pb2.INTERVAL_1D,
        )
        with pytest.raises(grpc.RpcError) as exc_info:
            grpc_stub.GetHistory(req, timeout=15)
        assert exc_info.value.code() == grpc.StatusCode.INVALID_ARGUMENT

    def test_get_info_empty_symbol(self, grpc_stub, mock_yfinance):
        """GetInfo with an empty symbol returns INVALID_ARGUMENT gRPC error."""
        req = market_data_pb2.InfoRequest(
            symbol="",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        with pytest.raises(grpc.RpcError) as exc_info:
            grpc_stub.GetInfo(req, timeout=10)
        assert exc_info.value.code() == grpc.StatusCode.INVALID_ARGUMENT

    def test_search_instruments_empty_query(self, grpc_stub, mock_yfinance):
        """SearchInstruments with an empty query returns INVALID_ARGUMENT gRPC error."""
        req = market_data_pb2.SearchRequest(query="", max_results=5)
        with pytest.raises(grpc.RpcError) as exc_info:
            grpc_stub.SearchInstruments(req, timeout=10)
        assert exc_info.value.code() == grpc.StatusCode.INVALID_ARGUMENT


# ---------------------------------------------------------------------------
# Unknown / invalid ticker symbols
# ---------------------------------------------------------------------------


class TestUnknownSymbols:
    """Integration tests for unknown/invalid ticker symbols that yfinance returns no data for."""

    def test_get_price_unknown_symbol(self, grpc_stub, mock_yfinance):
        """GetPrice for an unknown symbol returns NOT_FOUND gRPC error."""
        req = market_data_pb2.PriceRequest(
            symbol="ZZZZZ",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        with pytest.raises(grpc.RpcError) as exc_info:
            grpc_stub.GetPrice(req, timeout=10)
        assert exc_info.value.code() == grpc.StatusCode.NOT_FOUND
        details: str = exc_info.value.details() or ""
        assert "ZZZZZ" in details

    def test_get_history_unknown_symbol(self, grpc_stub, mock_yfinance):
        """GetHistory for an unknown symbol returns NOT_FOUND gRPC error."""
        req = market_data_pb2.HistoryRequest(
            symbol="INVALID_TICKER",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
            interval=market_data_pb2.INTERVAL_1D,
        )
        with pytest.raises(grpc.RpcError) as exc_info:
            grpc_stub.GetHistory(req, timeout=15)
        assert exc_info.value.code() == grpc.StatusCode.NOT_FOUND
        details: str = exc_info.value.details() or ""
        assert "INVALID_TICKER" in details

    def test_get_info_unknown_symbol(self, grpc_stub, mock_yfinance):
        """GetInfo for an unknown symbol returns NOT_FOUND gRPC error."""
        req = market_data_pb2.InfoRequest(
            symbol="NONEXISTENT",
            asset_type=market_data_pb2.ASSET_TYPE_STOCK,
        )
        with pytest.raises(grpc.RpcError) as exc_info:
            grpc_stub.GetInfo(req, timeout=10)
        assert exc_info.value.code() == grpc.StatusCode.NOT_FOUND
        details: str = exc_info.value.details() or ""
        assert "NONEXISTENT" in details

    def test_get_price_unknown_crypto_symbol(self, grpc_stub, mock_yfinance):
        """GetPrice for an unknown crypto symbol also returns NOT_FOUND."""
        req = market_data_pb2.PriceRequest(
            symbol="ZZZZZ",
            asset_type=market_data_pb2.ASSET_TYPE_CRYPTO,
        )
        with pytest.raises(grpc.RpcError) as exc_info:
            grpc_stub.GetPrice(req, timeout=10)
        assert exc_info.value.code() == grpc.StatusCode.NOT_FOUND
