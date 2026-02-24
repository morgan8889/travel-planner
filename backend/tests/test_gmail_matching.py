"""Tests for Gmail trip matching logic."""
from datetime import date
from unittest.mock import MagicMock

import pytest

from travel_planner.routers._gmail_matching import match_to_trip


def _make_trip(trip_id: str, destination: str, start: date, end: date) -> MagicMock:
    t = MagicMock()
    t.id = trip_id
    t.destination = destination
    t.start_date = start
    t.end_date = end
    return t


# ------- date matching -------

def test_single_date_match_returns_trip():
    """One trip whose range contains the parsed date → return that trip."""
    trips = [_make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22))]
    result = match_to_trip(parsed_date=date(2026, 3, 15), parsed_location="", trips=trips)
    assert result == "t1"


def test_no_date_match_returns_none():
    """No trip covers the parsed date → return None (unmatched)."""
    trips = [_make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22))]
    result = match_to_trip(parsed_date=date(2026, 7, 1), parsed_location="", trips=trips)
    assert result is None


def test_boundary_dates_match():
    """start_date and end_date are inclusive."""
    trips = [_make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22))]
    assert match_to_trip(date(2026, 3, 11), "", trips) == "t1"
    assert match_to_trip(date(2026, 3, 22), "", trips) == "t1"


# ------- multiple trips, location tiebreaker -------

def test_multiple_date_matches_location_tiebreaker():
    """Two trips overlap in date; location narrows it to one."""
    trips = [
        _make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22)),
        _make_trip("t2", "Austin, TX", date(2026, 3, 10), date(2026, 3, 20)),
    ]
    result = match_to_trip(date(2026, 3, 15), "Florida", trips)
    assert result == "t1"


def test_multiple_date_matches_ambiguous_returns_none():
    """Two trips overlap in date and location doesn't resolve it → None."""
    trips = [
        _make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22)),
        _make_trip("t2", "Miami, Florida", date(2026, 3, 10), date(2026, 3, 20)),
    ]
    result = match_to_trip(date(2026, 3, 15), "Florida", trips)
    assert result is None


def test_location_match_is_case_insensitive():
    """Location matching ignores case."""
    trips = [
        _make_trip("t1", "Florida", date(2026, 3, 11), date(2026, 3, 22)),
        _make_trip("t2", "Austin", date(2026, 3, 10), date(2026, 3, 20)),
    ]
    result = match_to_trip(date(2026, 3, 15), "FLORIDA", trips)
    assert result == "t1"


def test_empty_trips_returns_none():
    """No trips at all → None."""
    result = match_to_trip(date(2026, 3, 15), "Florida", [])
    assert result is None
