# MovieFrame
# MovieFrame

MovieFrame is a computer vision project for analyzing animation frames and identifying the visual and production techniques used to create them.

## Goal

given a single animation frame, MovieFrame will use a multi-label ML model to identify:

- 2D animation
- 3D animation
- Cel shading

3D frames, the model will explore identifying production software such as:
- Blender
- Maya

2D frames, the model will explore identifying software such as:
- Toon Boom Harmony
- TVPaint
- Other commonly used 2D animation software

The project will investigate whether these techniques and software pipelines leave recognizable visual patterns in a finished frame.

## Tech Stack

- Python
- FastAPI
- OpenCV
- NumPy
- PyTorch
- Computer Vision / Machine Learning

## Status

Currently building the image analysis pipeline and dataset.