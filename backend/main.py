from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import predict

app = FastAPI(title="VoiceGuard API", version="1.0.1")

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins during local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)

@app.get("/")
def root():
    return {"status": "online", "message": "VoiceGuard API is online"}