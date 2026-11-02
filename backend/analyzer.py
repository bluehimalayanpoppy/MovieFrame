import cv2
import numpy as np


def analyze_image(contents):
    # convert bytes to numpy array
    array = np.frombuffer(contents, np.uint8)

    # decode image with OpenCV, returns numpy array
    img = cv2.imdecode(array, cv2.IMREAD_COLOR)

    if img is None:
        return {"error": "Could not decode image"}

    # rows, columns, channels from numpy shape
    height, width, channels = img.shape

    return {
        "message": "Image successfully decoded",
        "width": width,
        "height": height,
        "channels": channels,
    }