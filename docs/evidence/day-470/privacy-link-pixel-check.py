"""Check the reported clipped D in the documented Android privacy fixture.

Requires Pillow. Input: original 1080x2424 PNG, Pixel 9, font_scale=2.0,
dark appearance, privacy sheet fully scrolled to the end. This deliberately
checks a fixed native fixture; it is not a general layout or accessibility test.
"""

import sys

from PIL import Image

image = Image.open(sys.argv[1]).convert("RGB")
assert image.size == (1080, 2424), "Use the documented fixture and original PNG"

# The left vertical stem of D in Datenschutz must be continuous here.
# A visible accessibility label cannot detect the pill mask eating this stem.
rows = range(1640, 1681)
visible = 0
for y in rows:
    red, green, blue = image.getpixel((68, y))
    visible += red < 60 and green > 130 and blue > 180

print(f"D left stem: {visible}/{len(rows)} cyan pixels")
assert visible >= 36, "Clipped left stem, or input does not match the fixture"
