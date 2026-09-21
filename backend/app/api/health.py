from fastapi import APIRouter
from app.schemas.investigation import HealthCheck

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthCheck)
async def get_health():
    """
    Health check endpoint. Returns system status.
    """
    return {"status": "ok"}
