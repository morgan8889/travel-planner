from travel_planner.db import async_session, engine, get_db


def test_engine_exists():
    assert engine is not None


def test_async_session_factory_exists():
    assert async_session is not None


def test_get_db_is_async_generator():
    import inspect
    assert inspect.isasyncgenfunction(get_db)
