import { useEffect, useState } from "react";

// Put these stills in frontend/public/backgrounds/ and match each film name.
// Studio Ghibli released these stills for free use "within common sense": https://www.ghibli.jp/works/
const SLIDES = [
  { src: "/backgrounds/1.jpg", film: "Spirited Away" },
  { src: "/backgrounds/2.jpg", film: "The Wind Rises" },
  { src: "/backgrounds/3.jpg", film: "Ponyo" },
  { src: "/backgrounds/4.jpg", film: "When Marnie Was There" },
  { src: "/backgrounds/5.jpg", film: "The Tale of the Princess Kaguya" },
];

const SLIDE_MS = 8000; // time each still stays on screen

// Full-screen slideshow: each still slowly pans and zooms, then crossfades to the next.
export default function Background() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="background" aria-hidden="true">
      {SLIDES.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt=""
          // alternate pan direction so consecutive slides feel different
          className={`bg-slide ${i % 2 ? "pan-left" : "pan-right"} ${i === index ? "active" : ""}`}
        />
      ))}
      <div className="bg-overlay" />
      <p className="bg-credit">
        Still from {SLIDES[index].film} © Studio Ghibli
      </p>
    </div>
  );
}
