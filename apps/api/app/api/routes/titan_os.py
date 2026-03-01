from __future__ import annotations

import json
from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.db.pool import get_pool
from app.schemas.activities import (
    ActivityCompleteOut,
    ActivityCreate,
    ActivityOut,
    ActivityKind,
    ActivityStatus,
    ProgressOut,
)
from app.schemas.domains import DomainOut
from app.schemas.modules import ModuleOut
from app.services.progression import compute_level

router = APIRouter(tags=["titan_os"])


USER_ID = UUID("00000000-0000-0000-0000-000000000000")


def _normalize_activity(row: dict) -> dict:
    meta = row.get("metadata")
    if isinstance(meta, str):
        try:
            row["metadata"] = json.loads(meta)
        except json.JSONDecodeError:
            row["metadata"] = {}
    return row


@router.get("/domains", response_model=list[DomainOut])
async def list_domains():
    pool = await get_pool()
    rows = await pool.fetch(
        """
        select id, name, sort_order, created_at
        from public.domains
        order by sort_order asc, name asc
        """
    )
    return [dict(r) for r in rows]


@router.get("/modules", response_model=list[ModuleOut])
async def list_modules(domain: str | None = Query(default=None)):
    pool = await get_pool()

    where = []
    params: list[object] = []

    if domain:
        try:
            domain_id = UUID(domain)
            where.append("m.domain_id = $1")
            params.append(domain_id)
        except ValueError:
            where.append("d.name = $1")
            params.append(domain)

    where_sql = f"where {' and '.join(where)}" if where else ""
    rows = await pool.fetch(
        f"""
        select m.id, m.domain_id, m.name, m.sort_order, m.icon, m.created_at
        from public.modules m
        join public.domains d on d.id = m.domain_id
        {where_sql}
        order by m.sort_order asc, m.name asc
        """,
        *params,
    )
    return [dict(r) for r in rows]


@router.get("/activities", response_model=list[ActivityOut])
async def list_activities(
    domain: str | None = Query(default=None),
    module_id: UUID | None = Query(default=None),
    kind: ActivityKind | None = Query(default=None),
    status: ActivityStatus | None = Query(default=None),
    due_from: date | None = Query(default=None),
    due_to: date | None = Query(default=None),
):
    where = ["a.user_id = $1"]
    params: list[object] = [USER_ID]

    pool = await get_pool()

    if domain:
        params.append(domain)
        where.append(f"d.name = ${len(params)}")
    if module_id:
        exists = await pool.fetchval(
            "select 1 from public.modules where id = $1", module_id
        )
        if not exists:
            raise HTTPException(status_code=404, detail="module_id not found")
        params.append(module_id)
        where.append(f"a.module_id = ${len(params)}")
    if kind:
        params.append(kind)
        where.append(f"a.kind = ${len(params)}::activity_kind")
    if status:
        params.append(status)
        where.append(f"a.status = ${len(params)}::activity_status")
    if due_from:
        params.append(due_from)
        where.append(f"a.due_date >= ${len(params)}")
    if due_to:
        params.append(due_to)
        where.append(f"a.due_date <= ${len(params)}")

    rows = await pool.fetch(
        f"""
        select a.id, a.user_id, a.module_id, a.kind, a.status, a.title, a.notes,
               a.xp_reward, a.due_date, a.started_at, a.completed_at, a.metadata, a.created_at
        from public.activities a
        left join public.modules m on m.id = a.module_id
        left join public.domains d on d.id = m.domain_id
        where {' and '.join(where)}
        order by
          (case when a.status = 'active' then 0 else 1 end) asc,
          (case when a.status = 'active' then a.due_date end) asc nulls last,
          (case when a.status = 'active' then a.created_at end) desc,
          (case when a.status = 'completed' then a.completed_at end) desc nulls last,
          a.created_at desc
        """,
        *params,
    )
    return [_normalize_activity(dict(r)) for r in rows]


@router.post("/activities", response_model=ActivityOut)
async def create_activity(payload: ActivityCreate):
    pool = await get_pool()

    if payload.module_id is not None:
        exists = await pool.fetchval(
            "select 1 from public.modules where id = $1", payload.module_id
        )
        if not exists:
            raise HTTPException(status_code=404, detail="module_id not found")

    row = await pool.fetchrow(
        """
        insert into public.activities (
          user_id, module_id, kind, status, title, notes, xp_reward, due_date, started_at, metadata
        )
        values ($1, $2, $3::activity_kind, 'active'::activity_status, $4, $5, $6, $7, $8, $9::jsonb)
        returning id, user_id, module_id, kind, status, title, notes,
                  xp_reward, due_date, started_at, completed_at, metadata, created_at
        """,
        USER_ID,
        payload.module_id,
        payload.kind,
        payload.title,
        payload.notes,
        payload.xp_reward,
        payload.due_date,
        payload.started_at,
        json.dumps(payload.metadata or {}),
    )
    return _normalize_activity(dict(row))


@router.post("/activities/{activity_id}/complete", response_model=ActivityCompleteOut)
async def complete_activity(activity_id: UUID):
    pool = await get_pool()

    activity_row = await pool.fetchrow(
        """
        update public.activities
        set status = 'completed'::activity_status, completed_at = now()
        where id = $1 and user_id = $2
        returning id, user_id, module_id, kind, status, title, notes,
                  xp_reward, due_date, started_at, completed_at, metadata, created_at
        """,
        activity_id,
        USER_ID,
    )
    if activity_row is None:
        raise HTTPException(status_code=404, detail="Activity not found")

    xp_reward = int(activity_row["xp_reward"] or 0)
    if xp_reward > 0:
        await pool.execute(
            """
            insert into public.xp_ledger (user_id, delta_xp, reason, ref_type, ref_id)
            values ($1, $2, $3, 'activity', $4)
            """,
            USER_ID,
            xp_reward,
            f"Activity completed: {activity_row['title']}",
            str(activity_id),
        )

    total_xp = await pool.fetchval(
        """
        select coalesce(sum(delta_xp), 0)
        from public.xp_ledger
        where user_id = $1
        """,
        USER_ID,
    )
    total_xp_int = int(total_xp or 0)
    level_info = compute_level(total_xp_int)
    level = int(level_info["level"])

    rank_row = await pool.fetchrow(
        """
        select name
        from public.ranks
        where min_level <= $1
        order by min_level desc
        limit 1
        """,
        level,
    )
    rank = str(rank_row["name"]) if rank_row else "Unranked"

    progress = ProgressOut(
        user_id=USER_ID,
        total_xp=total_xp_int,
        level=level,
        xp_into_level=int(level_info["xp_into_level"]),
        xp_for_next_level=int(level_info["xp_for_next_level"]),
        rank=rank,
    )

    return ActivityCompleteOut(
        id=activity_row["id"],
        status=activity_row["status"],
        completed_at=activity_row["completed_at"],
        progress=progress,
    )
