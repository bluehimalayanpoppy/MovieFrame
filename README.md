# MovieFrame

Classifies frames from films and games by animation style: 2D, 3D, cel-shaded, or hybrid.

Live: https://movie-frame.vercel.app

Built with React and Vite on the frontend and FastAPI with OpenCV on the backend.

## Running locally

Backend:

```bash
cd backend
pip3 install -r ../requirements.txt
uvicorn main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Training stills are from Studio Ghibli's free-use releases. Not affiliated with Studio Ghibli.
