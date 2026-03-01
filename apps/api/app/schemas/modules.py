from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ModuleOut(BaseModel):
    id: UUID
    domain_id: UUID
    name: str
    sort_order: int
    icon: str | None
    created_at: datetime

