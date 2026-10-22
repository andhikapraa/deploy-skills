# syntax=docker/dockerfile:1
# Python web app (FastAPI, Flask, Django) with requirements.txt.
FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN useradd --system --uid 1001 --no-create-home app
COPY --chown=app:app . .
USER app
EXPOSE 8000
# FastAPI shown. Flask: ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]. Django: ["gunicorn", "-b", "0.0.0.0:8000", "<project>.wsgi"]. Add gunicorn to requirements.txt for those.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
