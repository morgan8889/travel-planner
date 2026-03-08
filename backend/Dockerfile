FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install production dependencies only
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application source and migrations
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "travel_planner.main:app", "--host", "0.0.0.0", "--port", "8000"]
