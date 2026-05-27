#!/usr/bin/env python3

import os
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ============================================================
# RPG Maker MZ Combined Stitcher & ID Annotator
# ============================================================

TILE_SIZE_DEFAULT = 32
FONT_SIZE = 10
FONT_PATH = "C:/Windows/Fonts/consolab.ttf"

SHEET_OFFSETS = {
    "B": 0,
    "C": 256,
    "D": 512,
    "E": 768,
}

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

# ============================================================
# Utilities
# ============================================================

def ask_choice(prompt: str, options):
    opts = "/".join(options)
    while True:
        ans = input(f"{prompt} ({opts}): ").strip().upper()
        if ans in options:
            return ans
        print("Invalid choice, try again.")


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


def get_text_color():
    return (255, 255, 255, 200)


def load_and_normalise(folder: Path, target_sz: int):
    """Loads PNGs and tracks their original filenames alongside the image data."""
    file_list = sorted(folder.glob("*.png"))
    imgs_with_paths = []
    
    for p in file_list:
        im = Image.open(p).convert("RGBA")
        if im.size != (target_sz, target_sz):
            bg = Image.new("RGBA", (target_sz, target_sz), (0, 0, 0, 0))
            offset = ((target_sz - im.width) // 2, (target_sz - im.height) // 2)
            bg.paste(im, offset)
            im = bg
        imgs_with_paths.append((im, p))
    return imgs_with_paths


def stitch_grid(images_with_paths, cols, rows, tile_sz):
    canvas = Image.new("RGBA", (cols * tile_sz, rows * tile_sz), (0, 0, 0, 0))
    idx = 0
    for r in range(rows):
        for c in range(cols):
            if idx >= len(images_with_paths):
                return canvas
            x, y = c * tile_sz, r * tile_sz
            canvas.paste(images_with_paths[idx][0], (x, y))
            idx += 1
    return canvas


# ============================================================
# Character Sheet Logic
# ============================================================

def character_sheet_flow():
    mode = ask_choice("Create character asset", ["SINGLE", "MULTI"])
    sprite_sz = int(input("Sprite size (48, 32, 24, or 16): ").strip())

    if mode == "SINGLE":
        folder = Path(input("Folder with this character's PNGs: ").strip())
        imgs_data = load_and_normalise(folder, sprite_sz)
        sheet = stitch_grid(imgs_data, 4, 4, sprite_sz)
        out_name = f"${folder.name}.png"
        sheet.save(out_name)
        print(f"Saved {out_name}")
    else:
        n = int(input("How many characters? ").strip())
        all_imgs = []
        for i in range(n):
            folder = Path(input(f"Folder for character {i+1}: ").strip())
            all_imgs.extend(load_and_normalise(folder, sprite_sz))
        
        cols = math.ceil(n / 2)
        rows = 2
        if n % 2:
            placeholder = Image.new("RGBA", (sprite_sz, sprite_sz), (0, 0, 0, 0))
            all_imgs.append((placeholder, Path("placeholder.png")))

        sheet = stitch_grid(all_imgs, cols, rows, sprite_sz)
        out_name = "combined_characters.png"
        sheet.save(out_name)
        print(f"Saved {out_name}")


# ============================================================
# Tileset Logic & Mapping
# ============================================================

def tileset_flow():
    t_type = ask_choice("Tileset type", ["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"])
    sprite_sz = int(input("Sprite size (48, 32, 24, or 16): ").strip())
    canvas_w, canvas_h = DIM_TABLE[sprite_sz][t_type]

    folder = Path(input("Folder with source tile PNGs: ").strip())
    
    # Prompt the user if they want the visual layout numbers burned into the image
    use_overlay = ask_choice("Apply transparent tile IDs overlay onto image?", ["Y", "N"]) == "Y"

    tiles_data = load_and_normalise(folder, sprite_sz)

    cols = canvas_w // sprite_sz
    rows = canvas_h // sprite_sz

    # 1. Canvas setup
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    overlay = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = load_font()

    # Determine baseline database offset ID
    base_id = SHEET_OFFSETS.get(t_type, 0)
    
    print("\n--- STITCHING & MAPPING MANIFEST ---")
    
    idx = 0
    leave_blank = (t_type == "B")
    
    # 2. Iterate through grid spaces to stitch images and compile names
    for r in range(rows):
        for c in range(cols):
            # Calculate what the relative RPG Maker tile calculation index is
            current_tile_id = base_id + (r * cols) + c
            
            if leave_blank and r == 0 and c == 0:
                print(f"Tile {current_tile_id:4} -> [SYSTEM BLANK (Row {r}, Col {c})]")
                continue
                
            if idx >= len(tiles_data):
                break
                
            tile_img, file_path = tiles_data[idx]
            x, y = c * sprite_sz, r * sprite_sz
            
            # Paste onto base canvas
            canvas.paste(tile_img, (x, y))
            
            # SAFE PILLOW FIX: Isolate the alpha channel directly as an independent 
            # single-channel map, then process its sequence of true integers.
            alpha_image = tile_img.getchannel('A')
            alpha_channels = alpha_image.get_flattened_data()
            has_visible_pixels = any(alpha >= 32 for alpha in alpha_channels)
            
            if not has_visible_pixels:
                print(f"Tile {current_tile_id:4} -> Empty Transparent Grid Spot / Blank File")
                idx += 1
                continue
            
            # Print mapping manifest entry to console regardless of chosen overlay configuration
            print(f"Tile {current_tile_id:4} -> {file_path}")
            
            # 3. Label Text Properties (Only computed and drawn if requested by the user)
            if use_overlay:
                text = str(current_tile_id)
                text_color = get_text_color()
                bbox_text = draw.textbbox((0, 0), text, font=font)
                text_w = bbox_text[2] - bbox_text[0]
                text_h = bbox_text[3] - bbox_text[1]

                text_x = x + (sprite_sz // 2) - (text_w // 2)
                text_y = y + (sprite_sz // 2) - (text_h // 2)

                padding = 4
                rect = (
                    text_x - padding,
                    text_y - padding,
                    text_x + text_w + padding,
                    text_y + text_h + padding,
                )

                # Draw semi-transparent UI layers
                draw.rectangle(rect, fill=(0, 0, 0, 140))
                draw.text(
                    (text_x, text_y), text, font=font, fill=text_color,
                    stroke_width=2, stroke_fill=(0, 0, 0, 180)
                )
            idx += 1

    print("------------------------------------\n")

    # Combine transparent annotation overlay over stitched tiles if selected
    if use_overlay:
        final_image = Image.alpha_composite(canvas, overlay)
    else:
        final_image = canvas
        
    out_name = f"{t_type}_output.png"
    final_image.save(out_name)
    print(f"Tileset saved as {out_name}")


# ============================================================
# Execution Entrypoint
# ============================================================

def main():
    while True:
        choice = ask_choice("What would you like to generate", ["CHAR", "TILE", "QUIT"])
        if choice == "CHAR":
            character_sheet_flow()
        elif choice == "TILE":
            tileset_flow()
        else:
            print("Good-bye!")
            break

if __name__ == "__main__":
    main()
