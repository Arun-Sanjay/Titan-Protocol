from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.pool import get_pool

router = APIRouter(prefix="/xp", tags=["xp"])


class XPAwardRequest(BaseModel):
    delta_xp: int
    reason: str
    ref_type: str | None = None
    ref_id: str | None = None


@router.post("/award")
async def award_xp(payload: XPAwardRequest):
    user_id = "00000000-0000-0000-0000-000000000000"

    if payload.delta_xp == 0:
        raise HTTPException(status_code=400, detail="delta_xp must not be 0")

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        insert into public.xp_ledger (user_id, delta_xp, reason, ref_type, ref_id)
        values ($1, $2, $3, $4, $5)
        returning id, user_id, delta_xp, reason, ref_type, ref_id, created_at
        """,
        user_id,
        payload.delta_xp,
        payload.reason,
        payload.ref_type,
        payload.ref_id,
    )

    return dict(row)


@router.get("/ledger")
async def get_ledger():
    user_id = "00000000-0000-0000-0000-000000000000"

    pool = await get_pool()
    rows = await pool.fetch(
        """
        select id, user_id, delta_xp, reason, ref_type, ref_id, created_at
        from public.xp_ledger
        where user_id = $1
        order by created_at desc
        limit 20
        """,
        user_id,
    )

    return [dict(r) for r in rows]

