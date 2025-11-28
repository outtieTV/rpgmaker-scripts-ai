"""
combine-sheet.py

Python 3.x
Run in Idle and answer prompts to combine a set of tiles for a tileset or a set of sprites for a charactersheet.
"""
import os
import math
from pathlib import Path
from PIL import Image

# -------------------------------------------------
# 1 Tileset dimension tables (output canvas size)
# -------------------------------------------------
DIM_TABLE = {
    48: {
        "A1": (768, 576), "A2": (768, 576),
        "A3": (768, 384), "A4": (768, 720), "A5": (384, 768),
        "B":  (768, 768), "C": (768, 768), "D": (768, 768), "E": (768, 768),
    },
    32: {
        "A1": (512, 384), "A2": (512, 384),
        "A3": (512, 256), "A4": (512, 480), "A5": (256, 512),
        "B":  (512, 512), "C": (512, 512), "D": (512, 512), "E": (512, 512),
    },
    24: {
        "A1": (384, 288), "A2": (384, 288),
        "A3": (384, 192), "A4": (384, 360), "A5": (192, 384),
        "B":  (384, 384), "C": (384, 384), "D": (384, 384), "E": (384, 384),
    },
    16: {
        "A1": (256, 192), "A2": (256, 192),
        "A3": (256, 128), "A4": (256, 240), "A5": (128, 256),
        "B":  (256, 256), "C": (256, 256), "D": (256, 256), "E": (256, 256),
    },
}

# -------------------------------------------------
# 2 Helper utilities
# -------------------------------------------------
def ask_choice(prompt: str, options):
    """Generic menu – returns a validated option."""
    opts = "/".join(options)
    while True:
        ans = input(f"{prompt} ({opts}): ").strip().upper()
        if ans in options:
            return ans
        print("Invalid choice, try again.")

def load_and_normalise(folder: Path, target_sz: int):
    """Load PNGs, centre‑pad to target_sz×target_sz, return list of Images."""
    imgs = []
    for p in sorted(folder.glob("*.png")):
        im = Image.open(p).convert("RGBA")
        if im.size != (target_sz, target_sz):
            bg = Image.new("RGBA", (target_sz, target_sz), (0, 0, 0, 0))
            offset = ((target_sz - im.width) // 2, (target_sz - im.height) // 2)
            bg.paste(im, offset)
            im = bg
        imgs.append(im)
    return imgs

def stitch_grid(images, cols, rows, tile_sz):
    """Create a canvas and paste images row‑major."""
    canvas = Image.new("RGBA", (cols * tile_sz, rows * tile_sz), (0, 0, 0, 0))
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= len(images):
                return canvas
            x, y = c * tile_sz, r * tile_sz
            canvas.paste(images[idx], (x, y))
            idx += 1
    return canvas

# -------------------------------------------------
# 3 Character‑sheet generation
# -------------------------------------------------
def character_sheet_flow():
    mode = ask_choice(
        "Create character asset", ["SINGLE", "MULTI"]
    )
    anim_type = ask_choice(
        "Animation style", ["STATIC", "DYNAMIC"]
    )
    sprite_sz = int(input("Sprite size (48, 32, 24, or 16): ").strip())

    if mode == "SINGLE":
        folder = Path(input("Folder with this character's PNGs: ").strip())
        imgs = load_and_normalise(folder, sprite_sz)

        # 4 directions × 4 rows (static) or 4 directions × 4 frames (dynamic)
        cols = 4
        rows = 4
        sheet = stitch_grid(imgs, cols, rows, sprite_sz)

        out_name = f"${folder.name}.png"
        sheet.save(out_name)
        print(f"Saved {out_name}")

    else:  # MULTI
        n = int(input("How many characters? ").strip())
        all_imgs = []
        max_sz = sprite_sz  # we already know the target size

        for i in range(n):
            folder = Path(input(f"Folder for character {i+1}: ").strip())
            all_imgs.extend(load_and_normalise(folder, max_sz))

        # Determine grid: two rows, ceil(n/2) columns
        cols = math.ceil(n / 2)
        rows = 2
        # If odd, add a transparent placeholder to keep the rectangle even
        if n % 2:
            placeholder = Image.new("RGBA", (max_sz, max_sz), (0, 0, 0, 0))
            all_imgs.append(placeholder)

        sheet = stitch_grid(all_imgs, cols, rows, max_sz)
        out_name = "combined_characters.png"
        sheet.save(out_name)
        print(f"Saved {out_name}")

# -------------------------------------------------
# 4 Tileset generation
# -------------------------------------------------
def tileset_flow():
    t_type = ask_choice(
        "Tileset type", ["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"]
    )
    sprite_sz = int(input("Sprite size (48, 32, 24, or 16): ").strip())
    canvas_w, canvas_h = DIM_TABLE[sprite_sz][t_type]

    folder = Path(input("Folder with source tile PNGs: ").strip())
    tiles = load_and_normalise(folder, sprite_sz)

    cols = canvas_w // sprite_sz
    rows = canvas_h // sprite_sz

    # B‑type rule: first cell left blank
    leave_blank = t_type == "B"
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    idx = 0
    for r in range(rows):
        for c in range(cols):
            if leave_blank and r == 0 and c == 0:
                continue
            if idx >= len(tiles):
                break
            x, y = c * sprite_sz, r * sprite_sz
            canvas.paste(tiles[idx], (x, y))
            idx += 1

    out_name = f"{t_type}_output.png"
    canvas.save(out_name)
    print(f"Tileset saved as {out_name}")

# -------------------------------------------------
# 5 Main menu
# -------------------------------------------------
def main():
    while True:
        choice = ask_choice(
            "What would you like to generate", ["CHAR", "TILE", "QUIT"]
        )
        if choice == "CHAR":
            character_sheet_flow()
        elif choice == "TILE":
            tileset_flow()
        else:
            print("Good‑bye!")
            break

if __name__ == "__main__":
    main()
