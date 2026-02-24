"""Pure trip-matching logic for Gmail import.

Given a parsed booking date and location string, returns the single best-matching
trip ID, or None if ambiguous / no match.
"""

from collections.abc import Sequence
from datetime import date


def match_to_trip(
    parsed_date: date,
    parsed_location: str,
    trips: Sequence,
) -> str | None:
    """Return trip.id of the best matching trip, or None if unmatched/ambiguous."""
    # Step 1: filter by date range
    date_matches = [
        t
        for t in trips
        if t.start_date and t.end_date and t.start_date <= parsed_date <= t.end_date
    ]

    if not date_matches:
        return None

    if len(date_matches) == 1:
        return str(date_matches[0].id)

    # Step 2: use location as tiebreaker (case-insensitive substring)
    if parsed_location:
        loc_lower = parsed_location.lower()
        location_matches = [
            t
            for t in date_matches
            if loc_lower in (t.destination or "").lower()
            or (t.destination or "").lower() in loc_lower
        ]
        if len(location_matches) == 1:
            return str(location_matches[0].id)

    # Ambiguous
    return None
