
#from module fast api gets framework for api, file type for object (UploadFile),
# and File fast api instruction for parameter (File)
#will show how to get object from http request 
from fastapi import FastAPI, UploadFile, File

#instance 
#FastApi() constructor
app = FastAPI()

#defines path for http post
@app.post("/analyze")

def analyze():
    return {"message": "Hello World"}

#test if it works uvicorn main:app --reload