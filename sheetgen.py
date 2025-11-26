"""
Python 3.x Script

RPG Maker MZ - Stitch sprites together for character sheets or tilesets.
"""
import os
from PIL import Image

SPRITE_SIZES = (16, 32, 48)

def ask_choice():
    print("Create: (1) Single character sheet, (2) Multiple character sheet, (3) Tileset")
    return input("> ").strip()

def get_sprite_folder(prompt):
    folder = input(prompt).strip()
    return [os.path.join(folder, f) for f in os.listdir(folder) if f.lower().endswith('.png')]

def load_and_pad(paths, target):
    imgs = []
    for p in paths:
        im = Image.open(p).convert('RGBA')
        if im.size != (target, target):
            bg = Image.new('RGBA', (target, target), (0,0,0,0))
            bg.paste(im, ((target-im.width)//2, (target-im.height)//2))
            im = bg
        imgs.append(im)
    return imgs

def stitch_grid(images, cols, rows, size):
    sheet = Image.new('RGBA', (cols*size, rows*size), (0,0,0,0))
    for idx, img in enumerate(images):
        x = (idx % cols) * size
        y = (idx // cols) * size
        sheet.paste(img, (x, y))
    return sheet

def main():
    mode = ask_choice()
    if mode == "1":                     # single character
        static = input("Static (s) or dynamic (d)? ").lower().startswith('s')
        folder = get_sprite_folder("Folder with sprite PNGs: ")
        # determine common size
        sizes = {Image.open(p).size[0] for p in folder}
        target = max(sizes) if sizes else 32
        imgs = load_and_pad(folder, target)

        # arrange frames (4 directions × 4 rows)
        cols = 4
        rows = 4
        sheet = stitch_grid(imgs, cols, rows, target)
        name = f"${os.path.basename(os.path.dirname(folder))}.png"
        sheet.save(name)
        print(f"Saved {name}")

    elif mode == "2":                   # multiple characters
        n = int(input("How many characters? "))
        all_imgs = []
        for i in range(n):
            folder = get_sprite_folder(f"Folder for character {i+1}: ")
            sizes = {Image.open(p).size[0] for p in folder}
            target = max(sizes)
            all_imgs.extend(load_and_pad(folder, target))

        # grid layout: 2 rows, ceil(n/2) columns
        cols = (n + 1) // 2
        rows = 2
        # add placeholder if odd
        if n % 2:
            placeholder = Image.new('RGBA', (target, target), (0,0,0,0))
            all_imgs.append(placeholder)

        sheet = stitch_grid(all_imgs, cols, rows, target)
        sheet.save("combined_characters.png")
        print("Saved combined_characters.png")

    else:                               # tileset
        folder = get_sprite_folder("Folder with tile PNGs: ")
        sizes = {Image.open(p).size[0] for p in folder}
        target = max(sizes)
        imgs = load_and_pad(folder, target)

        # simple square layout
        cols = rows = int(len(imgs) ** 0.5) + 1
        sheet = stitch_grid(imgs, cols, rows, target)
        sheet.save("tileset.png")
        print("Saved tileset.png")

if __name__ == "__main__":
    main()
