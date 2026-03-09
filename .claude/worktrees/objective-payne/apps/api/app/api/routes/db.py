from fastapi import APIRouter

from app.db.pool import get_pool

router = APIRouter(prefix="/db", tags=["db"])


@router.get("/ping")
async def ping_db():
    pool = await get_pool()
    result = await pool.fetchval("select 1;")
    return {"ok": True, "result": result}

