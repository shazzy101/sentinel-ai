"""
Sentinel AI — Signal Detection Engine

Public re-exports for the signals package.
"""

from signals.patterns import (
    PatternHit,
    detect_stablecoin_staging,
    detect_contract_testing,
    detect_coordinated_accumulation,
    detect_quiet_whale_waking,
)
from signals.engine import (
    confidence_from,
    targets_for,
    build_signal,
    generate_explanation,
)

__all__ = [
    "PatternHit",
    "detect_stablecoin_staging",
    "detect_contract_testing",
    "detect_coordinated_accumulation",
    "detect_quiet_whale_waking",
    "confidence_from",
    "targets_for",
    "build_signal",
    "generate_explanation",
]
