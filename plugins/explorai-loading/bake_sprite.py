"""Bake image.png into a pixel sprite for the mod: one 6-digit hex color per pixel, '......' for transparent."""

import sys
from PIL import Image

SRC = sys.argv[1]
SIZE = int(sys.argv[2])
OUT = sys.argv[3]

im = Image.open(SRC).convert("RGBA").resize((SIZE, SIZE), Image.BOX)
rows = []
for y in range(SIZE):
    row = ""
    for x in range(SIZE):
        r, g, b, a = im.getpixel((x, y))
        row += "......" if a < 128 else f"{r:02x}{g:02x}{b:02x}"
    rows.append(row)

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Generated from image.png by bake_sprite.py\n")
    f.write("// One 6-digit hex color per pixel, '......' transparent; two rows per terminal cell\n")
    f.write("export const SPRITE = [\n")
    for row in rows:
        f.write(f"  '{row}',\n")
    f.write("]\n")

# Preview: '#' opaque, '.' transparent
for row in rows:
    print("".join("." if row[i : i + 6] == "......" else "#" for i in range(0, len(row), 6)))
