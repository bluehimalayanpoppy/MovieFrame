# MovieFrame

Classifies frames from films and games by animation style: 2D, 3D, cel-shaded, or hybrid.

**Live:** https://movie-frame.vercel.app

## How it works

Upload a single frame. The backend returns an independent score for each of three labels:

| Label | Meaning |
| --- | --- |
| `2d` | hand drawn or painted, flat layers |
| `3d` | modeled geometry, lit consistently across the object |
| `cel_shading` | 3D geometry rendered to look like flat art |

Labels are independent flags, so a frame can carry more than one. Hybrid means two or more are set, for example a 2D film with a 3D asset.

Visual tells the classifier looks for: lighting that stays consistent across a whole object, specular highlights that follow curvature, mechanically exact perspective, and repeated but varied instanced crowds. Compositing effects like glow, lens flare, and speed lines do not count as 3D.

## Built with

- **Frontend:** React and Vite, with a three.js background scene
- **Backend:** FastAPI and OpenCV
- **Hosting:** Vercel (frontend) and Render (backend)

## Running locally

Backend:

```
cd backend
pip3 install -r ../requirements.txt
uvicorn main:app --reload
```

Frontend:

```
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

## Project layout

```
backend/    FastAPI app and the frame analyzer
frontend/   React app
scripts/    dataset tools (label filling, synthetic renders)
data/       training data and uploads (git ignored, not in this repo)
tests/
```

## Dataset

Training data is kept private and is not included in the repo. Labels live in `data/training/labels/labels.csv`:

```
filename,source_film,split,2d,3d,cel_shading,notes
```

Splits are made by whole film, not by frame, so the model is never tested on a film it trained on.

Ground truth positives for `3d` and `cel_shading` come from `scripts/render_synthetic.py`, which renders the same random scene twice in Blender, once with standard shading and once with a toon shader:

```
blender -b -P scripts/render_synthetic.py -- /path/to/MovieFrame 40
```

## Credits

Training stills are from Studio Ghibli's free-use releases. Not affiliated with Studio Ghibli.
