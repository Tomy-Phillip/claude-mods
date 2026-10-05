"""Bake the Explorai PNG into a pixel mask for the mod: '#' = dark letters, 'g' = green '.ai', '.' = empty."""

import sys
from pathlib import Path
from PIL import Image

SRC = Path(__file__).parent / "explo_logo_rvb-NoirVert-ACFF13.png"
W, H = int(sys.argv[1]), int(sys.argv[2])
OUT = sys.argv[3]

src = Image.open(SRC).convert("RGBA")
flat = Image.new("RGBA", src.size, (255, 255, 255, 255))
flat.alpha_composite(src)
im = flat.convert("RGB").resize((W, H), Image.LANCZOS)
rows = []
for y in range(H):
    row = ""
    for x in range(W):
        r, g, b = im.getpixel((x, y))
        if r + g + b < 360:
            row += "#"
        elif g > 200 and b < 140:
            row += "g"
        else:
            row += "."
    rows.append(row)

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Generated from explo_logo_rvb-NoirVert-ACFF13.png by bake_logo.py\n")
    f.write("// '#' dark letters, 'g' green .ai, '.' empty; two rows per terminal cell\n")
    f.write("export const LOGO = [\n")
    for row in rows:
        f.write(f"  '{row}',\n")
    f.write("]\n")
print("\n".join(rows))
