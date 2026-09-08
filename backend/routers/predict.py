import os
import time
import shutil
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from models.audio_model import VoiceGuardPredictor

router = APIRouter(prefix="/api/predict", tags=["Prediction"])

# Initialize model predictor instance once on startup
predictor = VoiceGuardPredictor()


@router.post("/audio")
async def predict_audio(file: UploadFile = File(...)):
    start_time = time.perf_counter()

    # Extract and normalize file extension
    original_filename = file.filename or "unknown_audio"
    file_ext = os.path.splitext(original_filename)[1].lower()

    # Allowed extensions supported by FFmpeg pipeline
    allowed_extensions = [".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac", ".opus", ".wav"]
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "message": f"Unsupported file extension '{file_ext}'. Allowed formats: {allowed_extensions}"
            }
        )

    tmp_path = None
    try:
        # Save uploaded stream to a temporary file with original extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name

        # Run inference through VoiceGuard model
        prediction_result = predictor.predict(tmp_path)

        # Calculate total latency in milliseconds
        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Structured response payload
        return {
            "status": "success",
            "filename": original_filename,
            "processing_time_ms": execution_time_ms,
            "result": prediction_result
        }

    except HTTPException as http_ex:
        raise http_ex

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"Inference processing failed: {str(e)}"
            }
        )

    finally:
        # Cleanup temporary audio file from storage
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass