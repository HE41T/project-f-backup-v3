from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from resize_router import router as resize_router
# from resize_router import bilinear  # เปลี่ยนตาม path ที่ถูกต้องของคุณ


app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

# Allow frontend (React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include router
app.include_router(resize_router, prefix="/api/resize")



# from fastapi import FastAPI
# from resize_router import router as resize_router
# from fastapi.staticfiles import StaticFiles
# import os

# app = FastAPI()

# # Serve static folder for saved images
# os.makedirs("static", exist_ok=True)
# app.mount("/static", StaticFiles(directory="static"), name="static")

# app.include_router(resize_router, prefix="/api/resize")

