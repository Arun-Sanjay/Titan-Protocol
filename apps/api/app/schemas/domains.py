from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DomainOut(BaseModel):
    id: UUID
    name: str
    sort_order: int
    created_at: datetime

