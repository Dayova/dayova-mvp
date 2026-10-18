"""Reproduce settled answer-selection contrast from repository tokens (stdlib only)."""

import colorsys
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]


def luminance(hex_color):
    rgb = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    return sum(v * w for v, w in zip(linear, (0.2126, 0.7152, 0.0722)))


def contrast(a, b):
    low, high = sorted((luminance(a), luminance(b)))
    return (high + 0.05) / (low + 0.05)


def palettes():
    light_source = (ROOT / "src/lib/design-system.ts").read_text(encoding="utf-8")
    light = dict(re.findall(r'(\w+): "(#[0-9A-Fa-f]{6})"', light_source))
    dark_source = (ROOT / "src/lib/theme-variables.ts").read_text(encoding="utf-8")
    hsl = dict(re.findall(r'"--([\w-]+)": "([\d.]+ [\d.]+% [\d.]+%)"', dark_source))
    dark = {}
    for name, token in {"primary": "primary", "onPrimary": "on-primary", "text": "text", "systemSubtle": "system-subtle", "primaryStrong": "primary-strong"}.items():
        h, s, l = [float(v.rstrip("%")) for v in hsl[token].split()]
        rgb = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
        # Match JavaScript Math.round used by numericHslToHex, not Python bankers rounding.
        dark[name] = "#" + "".join(f"{math.floor(v * 255 + 0.5):02X}" for v in rgb)
    return {"light": light, "dark": dark}


def report():
    rows = []
    for theme, palette in palettes().items():
        for option in ("A-original", "B-current", "C-white-on-darker-blue"):
            badge = "#007DA8" if option.startswith("C") else palette["primary"]
            glyph = palette["onPrimary"] if option.startswith("B") else "#FFFFFF"
            body = palette["primary"] if option.startswith("A") else palette["text"]
            for element, fg, bg, threshold in (
                ("letter", glyph, badge, 4.5),
                ("checkmark", glyph, badge, 3.0),
                ("answer text", body, palette["systemSubtle"], 4.5),
                ("outline (supplementary)", badge, palette["systemSubtle"], 3.0),
            ):
                ratio = contrast(fg, bg)
                rows.append({"theme": theme, "option": option, "element": element, "foreground": fg, "background": bg, "ratio": round(ratio, 4), "reference_threshold": threshold, "meets_threshold": ratio >= threshold})
        rows.append({"theme": theme, "option": "existing primaryStrong sanity check", "element": "white letter", "foreground": "#FFFFFF", "background": palette["primaryStrong"], "ratio": round(contrast("#FFFFFF", palette["primaryStrong"]), 4)})
    return {"method": "WCAG 2.2 sRGB relative luminance; opaque settled token colors, not anti-aliased edge pixels or animation frames. Outline is supplementary to the check shape; its number is not a whole-control conformance verdict.", "rows": rows}


if __name__ == "__main__":
    assert contrast("#000000", "#FFFFFF") == 21
    assert contrast("#00BAFF", "#00BAFF") == 1
    result = report()
    Path(__file__).with_name("contrast.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    for row in result["rows"]:
        print(row["theme"], row["option"], row["element"], row["ratio"])
