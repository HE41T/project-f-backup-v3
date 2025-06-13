from .nearest import router as nearest_router
from .bilinear import router as bilinear_router
from .bicubic import router as bicubic_router
from fastapi import APIRouter

router = APIRouter()
router.include_router(nearest_router, prefix="/nearest")
router.include_router(bilinear_router, prefix="/bilinear")
router.include_router(bicubic_router, prefix="/bicubic")
