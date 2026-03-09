from fastapi import APIRouter

from app.db.pool import get_pool
from app.services.progression import compute_level

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("")
async def get_progress():
    user_id = "00000000-0000-0000-0000-000000000000"

    pool = await get_pool()

    total_xp = await pool.fetchval(
        """
        select coalesce(sum(delta_xp), 0)
        from public.xp_ledger
        where user_id = $1
        """,
        user_id,
    )
    total_xp_int = int(total_xp or 0)

    level_info = compute_level(total_xp_int)
    level = int(level_info["level"])

    rank_row = await pool.fetchrow(
        """
        select name, min_level
        from public.ranks
        where min_level <= $1
        order by min_level desc
        limit 1
        """,
        level,
    )
    rank = str(rank_row["name"]) if rank_row else "Unranked"

    return {
        "user_id": user_id,
        "total_xp": total_xp_int,
        "level": level,
        "xp_into_level": int(level_info["xp_into_level"]),
        "xp_for_next_level": int(level_info["xp_for_next_level"]),
        "rank": rank,
    }

