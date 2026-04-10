import pandas as pd


def _fetch(ticker, period, interval):
    try:
        import yfinance as yf
    except ImportError:
        raise ImportError("Run: pip install yfinance")

    df = yf.Ticker(ticker).history(period=period, interval=interval)
    if df.empty:
        raise RuntimeError(
            f"No data for {ticker} ({period}/{interval}). Check connection."
        )

    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.columns = ["open", "high", "low", "close", "volume"]
    df.dropna(inplace=True)
    return df


def load(period="1y", interval="1d"):
    """Load Nifty 50 primary timeframe data."""
    return _fetch("^NSEI", period, interval)


def load_htf(period="2y", interval="1wk"):
    """Load higher-timeframe (weekly) data for HTF bias filter."""
    return _fetch("^NSEI", period, interval)


def load_multi(period="1y", interval="1d", htf_period="2y", htf_interval="1wk"):
    """
    Load both primary and higher-timeframe data.

    Returns
    -------
    (primary_df, htf_df)
    """
    df     = load(period, interval)
    htf_df = load_htf(htf_period, htf_interval)
    return df, htf_df