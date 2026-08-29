"""Celery application skeleton.

Broker and result backend both point at ``REDIS_URL``. A beat schedule
placeholder is registered for periodic ingestion; the actual task bodies land in
FEAT-002. Importing this module must NOT require a live broker.
"""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "quant_feed",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

# Placeholder periodic schedule for ingestion. Task bodies are added in FEAT-002.
celery_app.conf.beat_schedule = {
    "ingest-news-every-15-min": {
        "task": "app.tasks.ingest.ingest_news",
        "schedule": crontab(minute="*/15"),
    },
}
