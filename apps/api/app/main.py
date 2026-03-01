from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from app.api.routes.db import router as db_router
from app.api.routes.progress import router as progress_router
from app.api.routes.quests import router as quests_router
from app.api.routes.titan_os import router as titan_os_router
from app.api.routes.xp import router as xp_router
from app.db.pool import close_pool, get_pool

app = FastAPI(
    title="Titan Protocol API",
    version="0.1.0",
)

env = (os.getenv("ENV", "dev") or "dev").lower()

origins: list[str]
allow_credentials: bool

if env == "dev":
    origins = ["*"]
    allow_credentials = False
else:
    raw = os.getenv("CORS_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()] if raw else []
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/debug/cors")
def debug_cors():
    return {"allowed_origins": origins}


@app.on_event("startup")
async def on_startup():
    await get_pool()


@app.on_event("shutdown")
async def on_shutdown():
    await close_pool()


@app.get("/")
async def root():
    return {"status": "Titan Protocol Online"}

@app.get("/health")
async def health():
    return {"status": "healthy"}


app.include_router(db_router)
app.include_router(progress_router)
app.include_router(quests_router)
app.include_router(xp_router)
app.include_router(titan_os_router, prefix="/os")
