
#from module fast api gets framework for api, file type for object (UploadFile),
# and File fast api instruction for parameter (File)
#will show how to get object from http request 
from fastapi import FastAPI, UploadFile, File
#open cv 
import cv2
import numpy as np 


#instance 
#FastApi() constructor
app = FastAPI()

#defines path for http post
@app.post("/analyze")

#type = file portion of http()
def analyze(image: UploadFile = File ()):

    #UploadFile object is image, file accesses file object
    contents = image.file.read()
    
    #convert bytes to numpy array 
    array = np.frombuffer(contents, np.uint8)
    
    #decodes to image
    img = cv2.imdecode(array, cv2.IMREAD_COLOR)
    
    return {"message": "Image received"}

#test if it works uvicorn main:app --reload