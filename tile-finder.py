#!/usr/bin/env python3

import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ============================================================
# RPG Maker MZ Tile ID Annotator
# Fixed visibility + correct B/C/D/E tile IDs
# ============================================================

TILE_SIZE = 32
FONT_SIZE = 10

# Optional font path
FONT_PATH = "C:/Windows/Fonts/consolab.ttf"

# ------------------------------------------------------------
# REAL RPG MAKER MZ TILE ID OFFSETS
# ------------------------------------------------------------
# B = 0
# C = 256
# D = 512
# E = 768
# ------------------------------------------------------------

SHEET_OFFSETS = {
    "B": 0,
    "C": 256,
    "D": 512,
    "E": 768,
}


# ============================================================
# Load font
# ============================================================

def load_font():
    if FONT_PATH:
        try:
            return ImageFont.truetype(FONT_PATH, FONT_SIZE)
        except Exception as e:
            print(f"Failed to load font: {e}")

    try:
        return ImageFont.truetype("arial.ttf", FONT_SIZE)
    except Exception:
        return ImageFont.load_default()


# ============================================================
# Determine readable text color
# ============================================================

def get_text_color():
    """
    Returns a consistent semi-transparent white.
    Since we draw a dark background box behind every ID, 
    white text provides the cleanest contrast across all tiles.
    """
    return (255, 255, 255, 200)


# ============================================================
# Annotate sheet
# ============================================================

def annotate_sheet(input_path: Path, output_path: Path, family: str):

    family = family.upper()

    if family not in SHEET_OFFSETS:
        raise ValueError("Family must be B, C, D, or E")

    base_id = SHEET_OFFSETS[family]

    image = Image.open(input_path).convert("RGBA")
    width, height = image.size

    # Create a blank, transparent overlay layer for the labels
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    font = load_font()

    cols = width // TILE_SIZE
    rows = height // TILE_SIZE

    print(f"Image Size : {width}x{height}")
    print(f"Grid       : {cols} x {rows}")
    print(f"Family     : {family}")
    print(f"Base ID    : {base_id}")
    print()

    tile_id = base_id

    for row in range(rows):
        for col in range(cols):

            x0 = col * TILE_SIZE
            y0 = row * TILE_SIZE
            x1 = x0 + TILE_SIZE
            y1 = y0 + TILE_SIZE

            tile = image.crop((x0, y0, x1, y1))

            # Check if the tile has any genuinely visible pixels (Alpha >= 32).
            has_visible_pixels = any(pixel[3] >= 32 for pixel in tile.getdata())

            if not has_visible_pixels:
                tile_id += 1
                continue

            text = str(tile_id)

            # Updated to use the clean, uniform color function
            text_color = get_text_color()

            bbox_text = draw.textbbox(
                (0, 0),
                text,
                font=font
            )

            text_w = bbox_text[2] - bbox_text[0]
            text_h = bbox_text[3] - bbox_text[1]

            # Center text
            text_x = x0 + (TILE_SIZE // 2) - (text_w // 2)
            text_y = y0 + (TILE_SIZE // 2) - (text_h // 2)

            # Larger darker background
            padding = 4

            rect = (
                text_x - padding,
                text_y - padding,
                text_x + text_w + padding,
                text_y + text_h + padding,
            )

            # Draw background box with a lighter alpha (140) to see sprites underneath
            draw.rectangle(
                rect,
                fill=(0, 0, 0, 140)
            )

            # Draw outlined text with alpha-enabled fill and stroke
            draw.text(
                (text_x, text_y),
                text,
                font=font,
                fill=text_color,
                stroke_width=2,
                stroke_fill=(0, 0, 0, 180)
            )

            print(
                f"Tile {tile_id:4} -> Row {row:2} Col {col:2}"
            )

            tile_id += 1

    # Alpha composite the transparent text overlay back onto the original image
    final_image = Image.alpha_composite(image, overlay)
    final_image.save(output_path)

    print()
    print(f"Saved annotated sheet -> {output_path}")


# ============================================================
# Main
# ============================================================

def main():

    if len(sys.argv) != 4:

        print()
        print("Usage:")
        print("  python annotate_tiles.py input.png output.png D")
        print()

        print("Families:")
        print("  B")
        print("  C")
        print("  D")
        print("  E")
        print()

        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    family = sys.argv[3]

    annotate_sheet(
        input_path,
        output_path,
        family
    )


if __name__ == "__main__":
    main()
