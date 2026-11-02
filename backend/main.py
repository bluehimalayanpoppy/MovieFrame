# FastAPI framework, UploadFile type, and File parameter marker
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from analyzer import analyze_image

app = FastAPI()

# allow the react dev server to call this API
import os

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

#post endpoint that accepts an uploaded image
@app.post("/analyze")
def analyze(image: UploadFile = File()):
    contents = image.file.read()
    return analyze_image(contents)

# run with: uvicorn main:app --reload