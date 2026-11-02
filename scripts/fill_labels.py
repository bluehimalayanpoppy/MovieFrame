"""
build labels.csv from scratch, one row per image in data/training/images/<folder>/.

labels come from each source's documented production style, not per-frame guesses.
To add a new source (a Pixar film, a game), add its folder to SOURCES below.

run from the MovieFrame root:
    python scripts/fill_labels.py
"""

import csv
from pathlib import Path

# paths are relative to the MovieFrame root, so the script works from any folder
ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "data" / "training" / "images"
LABELS_CSV = ROOT / "data" / "training" / "labels" / "labels.csv"

# folder name -> (source name, style, why the label is verifiable)
SOURCES = {
    "marnie": ("when_marnie_was_there", "2d", "Studio Ghibli hand-drawn production"),
    "ponyo": ("ponyo", "2d", "Studio Ghibli hand-drawn production"),
    "kokurikozaka": ("from_up_on_poppy_hill", "2d", "Studio Ghibli hand-drawn production"),
    "kazetachinu": ("the_wind_rises", "2d", "Studio Ghibli hand-drawn production"),
    "karigurashi": ("the_secret_world_of_arrietty", "2d", "Studio Ghibli hand-drawn production"),
    "kaguyahime": ("the_tale_of_the_princess_kaguya", "2d", "Studio Ghibli hand-drawn production"),
    "ged": ("tales_from_earthsea", "2d", "Studio Ghibli hand-drawn production"),
    "chihiro": ("spirited_away", "2d", "Studio Ghibli hand-drawn production"),
    # Examples for other classes, uncomment once you add the folders:
    # "toy_story": ("toy_story", "3d", "Pixar 3D CG production"),
    # "genshin": ("genshin_impact", "cel_shaded", "HoYoverse cel-shaded 3D rendering"),
    # "spiderverse": ("into_the_spider_verse", "hybrid", "Sony 3D CG with 2D linework and effects"),
}

# whole sources held out for testing, so near-identical frames never appear in train and test
TEST_SOURCES = {"ponyo"}

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
FIELDS = ["filename", "source", "style", "split", "label_source"]


def sort_key(path):
    # sort "2 - abc.jpg" before "10 - xyz.jpg"
    num = path.name.split(" - ")[0]
    return (int(num) if num.isdigit() else 10**9, path.name)


def main():
    if not IMAGES_DIR.is_dir():
        print(f"Can't find the images folder at: {IMAGES_DIR}")
        print("Check that fill_labels.py is inside MovieFrame/scripts/.")
        return

    rows = []
    skipped = []

    for folder in sorted(p for p in IMAGES_DIR.iterdir() if p.is_dir()):
        if folder.name not in SOURCES:
            skipped.append(folder.name)
            continue

        source, style, label_source = SOURCES[folder.name]
        split = "test" if folder.name in TEST_SOURCES else "train"

        images = sorted(
            (p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS),
            key=sort_key,
        )
        for img in images:
            rows.append({
                "filename": img.name,
                "source": source,
                "style": style,
                "split": split,
                "label_source": label_source,
            })

    LABELS_CSV.parent.mkdir(parents=True, exist_ok=True)
    with LABELS_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {LABELS_CSV}")
    if skipped:
        print(f"Skipped folders not in SOURCES: {', '.join(skipped)}")


if __name__ == "__main__":
    main()