from __future__ import annotations

import json
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db.pool import get_pool

router = APIRouter(prefix="/quests", tags=["quests"])

def parse_date(value: str | None) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(value)


class QuestCreateRequest(BaseModel):
    type: Literal["main", "side", "daily"]
    title: str
    description: str | None = None
    xp_reward: int = 0
    due_date: Optional[str] = None  # "YYYY-MM-DD"


class QuestUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    xp_reward: int | None = None
    due_date: Optional[str] = None
    is_active: bool | None = None


@router.post("")
async def create_quest(payload: QuestCreateRequest):
    user_id = "00000000-0000-0000-0000-000000000000"
    pool = await get_pool()

    try:
        due_date = parse_date(payload.due_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="due_date must be YYYY-MM-DD")

    quest_row = await pool.fetchrow(
        """
        insert into public.quests (user_id, type, title, description, xp_reward, due_date)
        values ($1, $2, $3, $4, $5, $6)
        returning *
        """,
        user_id,
        payload.type,
        payload.title,
        payload.description,
        payload.xp_reward,
        due_date,
    )

    await pool.execute(
        """
        insert into public.quest_events (user_id, quest_id, event_type, meta)
        values ($1, $2, 'created', $3::jsonb)
        """,
        user_id,
        quest_row["id"],
        json.dumps({"type": payload.type, "xp_reward": payload.xp_reward}),
    )

    return dict(quest_row)


@router.get("")
async def list_quests(
    type: Literal["main", "side", "daily"] | None = Query(default=None),
    active_only: bool = Query(default=True),
    completed: bool | None = Query(default=None),
):
    user_id = "00000000-0000-0000-0000-000000000000"

    where = ["user_id = $1"]
    params: list[object] = [user_id]

    if type is not None:
        params.append(type)
        where.append(f"type = ${len(params)}")

    if active_only:
        where.append("is_active = true")

    if completed is not None:
        params.append(completed)
        where.append(f"is_completed = ${len(params)}")

    pool = await get_pool()
    rows = await pool.fetch(
        f"""
        select *
        from public.quests
        where {' and '.join(where)}
        order by created_at desc
        """,
        *params,
    )
    return [dict(r) for r in rows]


@router.patch("/{quest_id}")
async def update_quest(quest_id: str, payload: QuestUpdateRequest):
    user_id = "00000000-0000-0000-0000-000000000000"

    updates: dict[str, object] = {}
    changed: dict[str, object] = {}

    fields_set = getattr(payload, "model_fields_set", getattr(payload, "__fields_set__", set()))

    if payload.title is not None:
        updates["title"] = payload.title
        changed["title"] = payload.title
    if payload.description is not None:
        updates["description"] = payload.description
        changed["description"] = payload.description
    if payload.xp_reward is not None:
        updates["xp_reward"] = payload.xp_reward
        changed["xp_reward"] = payload.xp_reward
    if "due_date" in fields_set:
        if payload.due_date is None:
            updates["due_date"] = None
            changed["due_date"] = None
        else:
            try:
                updates["due_date"] = parse_date(payload.due_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="due_date must be YYYY-MM-DD")
            changed["due_date"] = payload.due_date
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active
        changed["is_active"] = payload.is_active

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts: list[str] = []
    params: list[object] = [quest_id, user_id]
    for key, value in updates.items():
        params.append(value)
        set_parts.append(f"{key} = ${len(params)}")

    pool = await get_pool()
    quest_row = await pool.fetchrow(
        f"""
        update public.quests
        set {', '.join(set_parts)}
        where id = $1 and user_id = $2
        returning *
        """,
        *params,
    )
    if quest_row is None:
        raise HTTPException(status_code=404, detail="Quest not found")

    await pool.execute(
        """
        insert into public.quest_events (user_id, quest_id, event_type, meta)
        values ($1, $2, 'updated', $3::jsonb)
        """,
        user_id,
        quest_id,
        json.dumps({"changed": changed}),
    )

    return dict(quest_row)


@router.post("/{quest_id}/complete")
async def complete_quest(quest_id: str):
    user_id = "00000000-0000-0000-0000-000000000000"
    pool = await get_pool()

    quest_row = await pool.fetchrow(
        """
        update public.quests
        set is_completed = true, completed_at = now()
        where id = $1 and user_id = $2 and is_completed = false
        returning id, title, xp_reward
        """,
        quest_id,
        user_id,
    )

    if quest_row is None:
        existing = await pool.fetchrow(
            """
            select is_completed
            from public.quests
            where id = $1 and user_id = $2
            """,
            quest_id,
            user_id,
        )
        if existing is None:
            raise HTTPException(status_code=404, detail="Quest not found")
        raise HTTPException(status_code=400, detail="Quest already completed")

    await pool.execute(
        """
        insert into public.quest_events (user_id, quest_id, event_type, meta)
        values ($1, $2, 'completed', $3::jsonb)
        """,
        user_id,
        quest_id,
        json.dumps({}),
    )

    xp_reward = int(quest_row["xp_reward"] or 0)
    title = str(quest_row["title"] or "")

    if xp_reward > 0:
        await pool.execute(
            """
            insert into public.xp_ledger (user_id, delta_xp, reason, ref_type, ref_id)
            values ($1, $2, $3, 'quest', $4)
            """,
            user_id,
            xp_reward,
            f"Quest completed: {title}",
            quest_id,
        )

    return {"ok": True, "quest_id": quest_id, "xp_awarded": xp_reward}
