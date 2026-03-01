from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


ActivityKind = Literal["task", "session", "log"]
ActivityStatus = Literal["active", "completed", "skipped"]


class ActivityCreate(BaseModel):
    module_id: UUID | None = None
    kind: ActivityKind
    title: str
    notes: str | None = None
    xp_reward: int = 0
    due_date: date | None = None
    started_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ActivityOut(BaseModel):
    id: UUID
    user_id: UUID
    module_id: UUID | None
    kind: ActivityKind
    status: ActivityStatus
    title: str
    notes: str | None
    xp_reward: int
    due_date: date | None
    started_at: datetime | None
    completed_at: datetime | None
    metadata: dict[str, Any]
    created_at: datetime


class ProgressOut(BaseModel):
    user_id: UUID
    total_xp: int
    level: int
    xp_into_level: int
    xp_for_next_level: int
    rank: str


class ActivityCompleteOut(BaseModel):
    id: UUID
    status: ActivityStatus
    completed_at: datetime | None
    progress: ProgressOut | None = None

