"""
divide-sheet.py

Python 3.x
Run in Idle and answer prompts to divide a tileset/charactersheet into evenly-shaped PNGs.
"""

import os
from pathlib import Path

from PIL import Image


def get_padding(num_tiles: int) -> int:
    """Return the number of digits needed for zero‑padding."""
    return len(str(num_tiles))


def slice_image(
    img_path: Path,
    tile_w: int,
    tile_h: int,
    out_dir: Path,
) -> None:
    """Cut *img_path* into tiles of size (tile_w, tile_h) and save them."""
    img = Image.open(img_path)
    img_w, img_h = img.size

    # How many full tiles fit horizontally / vertically?
    cols = img_w // tile_w
    rows = img_h // tile_h
    total_tiles = cols * rows
    pad_len = get_padding(total_tiles)

    out_dir.mkdir(parents=True, exist_ok=True)

    idx = 1
    for row in range(rows):
        for col in range(cols):
            left = col * tile_w
            upper = row * tile_h
            right = left + tile_w
            lower = upper + tile_h

            tile = img.crop((left, upper, right, lower))

            filename = f"{str(idx).zfill(pad_len)}.png"
            tile.save(out_dir / filename)
            idx += 1

    print(f"✅ Saved {total_tiles} tiles to '{out_dir}'")


def main() -> None:
    # ----- user input -------------------------------------------------
    img_path_str = input("Enter image path (e.g. C:/pics/photo.png or image.png): ").strip()
    tile_w = int(input("Tile width (pixels): ").strip())
    tile_h = int(input("Tile height (pixels): ").strip())
    # ------------------------------------------------------------------

    img_path = Path(img_path_str).expanduser().resolve()
    if not img_path.is_file():
        raise FileNotFoundError(f"Image not found: {img_path}")

    output_dir = Path("./output")
    slice_image(img_path, tile_w, tile_h, output_dir)


if __name__ == "__main__":
    main()
