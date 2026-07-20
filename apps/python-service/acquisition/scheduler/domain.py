"""Scheduler domain — pure functions, no I/O, no clock, no random.

Same input -> same output. Everything here is testable with in-memory data.
"""

from __future__ import annotations


def next_tick(tick: int) -> int:
    """Advance the monotonic tick counter used by live/base polling loops.

    Kept pure and separate from the service loop (which owns the I/O:
    asyncio.sleep, the reader call, the on_reading callback) so the
    tick-advancement rule can be unit tested without touching asyncio.
    """
    return tick + 1
