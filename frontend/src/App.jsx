import { useState } from "react";
import Scene from "./Scene";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/analyze";

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Runs when the user picks a file
  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected)); // local preview, no upload yet
    setResult(null);
    setError("");
  }

  // Sends the image to the FastAPI backend
  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("image", file); // key must match the FastAPI parameter name

    try {
      const res = await fetch(API_URL, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      // fetch throws a TypeError when it can't reach the server at all
      setError(
        err instanceof TypeError
          ? "Couldn't reach the backend. Is uvicorn running on port 8000?"
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Scene />

      <main className="container">
        <header className="hero">
          <p className="eyebrow">Animation style classifier</p>
          <h1>MovieFrame</h1>
          <p className="subtitle">
            Upload a frame from a film or game to analyze its visual style.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="upload-form">
          <label className="file-picker">
            <input type="file" accept="image/*" onChange={handleFileChange} />
            {file ? file.name : "Choose an image"}
          </label>
          <button type="submit" disabled={!file || loading}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <section className="results">
          {preview && (
            <div className="card">
              <h2>Preview</h2>
              <img src={preview} alt="Uploaded frame" />
            </div>
          )}

          {result && (
            <div className="card">
              <h2>Result</h2>
              <dl className="stats">
                <dt>Width</dt>
                <dd>{result.width}px</dd>
                <dt>Height</dt>
                <dd>{result.height}px</dd>
                <dt>Channels</dt>
                <dd>{result.channels}</dd>
              </dl>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
