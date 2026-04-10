"""
BullShark/calibration.py
────────────────────────
Walk-forward validation and score-to-probability calibration.

Walk-forward ensures OOS test periods are evaluated on models trained
only on past data, preventing overfitting to thresholds chosen in-sample.

Usage
-----
  from BullShark import signals
  from BullShark.calibration import walk_forward, build_calibrator

  wf   = walk_forward(df, signals.generate, cfg)
  prob = build_calibrator(df, signals.generate, cfg)
  p    = prob(0.42)   # → e.g. 71.3  (% probability of positive return)
"""

import numpy as np
import pandas as pd


# ── WALK-FORWARD VALIDATION ────────────────────────────────────

def walk_forward(df, generate_fn, config, n_splits=5, min_train=120, fwd_period=5):
    """
    Anchored walk-forward out-of-sample validation.

    For each fold:
      - Train window  : df[0 : train_end]
      - Test window   : df[train_end : test_end]
      - Signals generated on the full slice (no future leakage)
      - OOS accuracy  : signal direction vs forward return

    Parameters
    ----------
    df          : OHLCV DataFrame
    generate_fn : callable (df, config) → signals DataFrame
    config      : strategy config dict
    n_splits    : number of OOS folds
    min_train   : minimum bars before first test fold
    fwd_period  : bars forward to evaluate directional accuracy

    Returns
    -------
    dict with per-fold results and aggregate OOS accuracy
    """
    n = len(df)
    required = min_train + n_splits * 20
    if n < required:
        return {
            "error":    "Insufficient data for walk-forward validation",
            "required": required,
            "got":      n,
        }

    fold_size = (n - min_train) // n_splits
    folds     = []

    for i in range(n_splits):
        train_end = min_train + i * fold_size
        test_end  = min(train_end + fold_size, n - fwd_period)

        if test_end - train_end < 10:
            continue

        # Generate signals on all data up to test_end (no future leak)
        sig_df = generate_fn(df.iloc[:test_end], config)
        test   = sig_df.iloc[train_end:test_end]

        metrics = _eval_oos(test, df["close"], train_end, fwd_period)
        metrics.update({
            "fold":       i + 1,
            "train_bars": train_end,
            "test_bars":  test_end - train_end,
        })
        folds.append(metrics)

    if not folds:
        return {"error": "No valid folds generated"}

    return {
        "folds":        folds,
        "oos_accuracy": round(float(np.mean([f["accuracy"] for f in folds])), 1),
        "oos_trades":   int(sum(f["n_signals"] for f in folds)),
        "n_folds":      len(folds),
        "fwd_period":   fwd_period,
    }


def _eval_oos(sig_df, close, global_offset, fwd_period):
    """Evaluate OOS directional accuracy against forward returns."""
    correct = 0
    total   = 0

    for local_i, (_, row) in enumerate(sig_df.iterrows()):
        sig = row.get("signal", "WAIT")
        if sig not in ("BUY", "STRONG BUY", "SELL", "STRONG SELL"):
            continue

        gi = global_offset + local_i
        if gi + fwd_period >= len(close):
            continue

        fwd = (close.iloc[gi + fwd_period] / close.iloc[gi] - 1) * 100
        if (sig in ("BUY", "STRONG BUY") and fwd > 0) or \
           (sig in ("SELL", "STRONG SELL") and fwd < 0):
            correct += 1
        total += 1

    acc = correct / total if total > 0 else 0.0
    return {
        "accuracy":  round(acc * 100, 1),
        "n_signals": total,
        "n_correct": correct,
    }


# ── SCORE → PROBABILITY CALIBRATION ───────────────────────────

def build_calibrator(df, generate_fn, config, fwd_period=5, n_bins=10):
    """
    Build a calibration function: composite score → P(positive return).

    Maps score bins to historical win rates using the supplied dataset.
    In a production walk-forward setup, call this only on the training
    fold and apply to the test fold.

    Parameters
    ----------
    df          : OHLCV DataFrame (use training split only)
    generate_fn : callable (df, config) → signals DataFrame
    config      : strategy config dict
    fwd_period  : bars ahead to measure return
    n_bins      : number of quantile bins for score bucketing

    Returns
    -------
    callable score → float (0–100), or None if insufficient data
    """
    sig_df = generate_fn(df, config)
    close  = df["close"]

    scores, outcomes = [], []

    for i in range(len(sig_df) - fwd_period):
        row = sig_df.iloc[i]
        if row["signal"] == "WAIT":
            continue
        fwd = (close.iloc[i + fwd_period] / close.iloc[i] - 1) * 100
        scores.append(float(row["score"]))
        outcomes.append(1 if fwd > 0 else 0)

    if len(scores) < n_bins * 3:
        return None  # insufficient data – fallback to heuristic

    scores   = np.array(scores)
    outcomes = np.array(outcomes)

    # Quantile bin edges (deduped)
    edges = np.unique(np.percentile(scores, np.linspace(0, 100, n_bins + 1)))

    bin_centers = []
    bin_probs   = []

    for j in range(len(edges) - 1):
        mask = (scores >= edges[j]) & (scores <= edges[j + 1])
        if mask.sum() > 0:
            bin_centers.append(float((edges[j] + edges[j + 1]) / 2))
            bin_probs.append(float(outcomes[mask].mean()))

    bin_centers = np.array(bin_centers)
    bin_probs   = np.array(bin_probs)

    def calibrate(score: float) -> float:
        """Return probability (0–100) of a positive 5-bar return."""
        if len(bin_centers) == 0:
            return 50.0
        idx = int(np.clip(
            np.searchsorted(bin_centers, score, side="right") - 1,
            0, len(bin_probs) - 1,
        ))
        return round(float(bin_probs[idx]) * 100, 1)

    return calibrate
