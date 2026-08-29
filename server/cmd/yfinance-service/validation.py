import math
from typing import Any
from proto import market_data_pb2


def price_to_cents(price: Any) -> int:
    """Convert float price to cents (int64)."""
    if price is None:
        return 0
    try:
        f = float(price)
        if math.isnan(f) or math.isinf(f):
            return 0
        return int(round(f * 100))
    except (ValueError, TypeError):
        return 0


def cents_to_price(cents: int) -> float:
    """Convert cents to float price."""
    return cents / 100.0


def interval_to_yf_interval(interval: int) -> str:
    """Convert proto Interval to yfinance interval string.

    Args:
        interval: A market_data_pb2.Interval enum value (int at runtime).
    """
    mapping: dict[int, str] = {
        market_data_pb2.INTERVAL_1M: "1m",
        market_data_pb2.INTERVAL_5M: "5m",
        market_data_pb2.INTERVAL_15M: "15m",
        market_data_pb2.INTERVAL_30M: "30m",
        market_data_pb2.INTERVAL_1H: "1h",
        market_data_pb2.INTERVAL_4H: "4h",
        market_data_pb2.INTERVAL_1D: "1d",
    }
    return mapping.get(interval, "1d")


def symbol_with_suffix(symbol: str, asset_type: int) -> str:
    """Add appropriate suffix to symbol based on asset type.

    Args:
        symbol: The ticker symbol (e.g. "AAPL", "BTC").
        asset_type: A market_data_pb2.AssetType enum value (int at runtime).
    """
    symbol = symbol.upper().strip()
    if asset_type == market_data_pb2.ASSET_TYPE_CRYPTO:
        if not symbol.endswith("-USD"):
            symbol = f"{symbol}-USD"
    return symbol
