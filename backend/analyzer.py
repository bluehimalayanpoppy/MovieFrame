import cv2 
import numpy as np 

                #bytes 
def analyze_image(contents):
    #convert bytes to numpy array
    array = np.frombuffer(contents, np.uint8)

    #decode image, returns numpy array w open cv 
    img = cv2.imdecode(array, cv2.IMREAD_COLOR)


    if img is None:
        return {"error": "Could not decode image"}

    #row,column, channel unpacking from numpy shape
    height, width, channels = img.shape

    return {
        "message": "Image successfully decoded",
        "width": width,
        "height": height,
        "channels": channels
    }