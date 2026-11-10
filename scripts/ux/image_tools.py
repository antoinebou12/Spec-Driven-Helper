"""Image tools for reviewing UI screenshots (OpenCV + Pillow).

Used on the Playwright UX tour output (test-results/ux/*.png) to look closely at details:

  crop    cut a region:                     image_tools.py crop in.png out.png --box 0 0 400 300
  zoom    crop and enlarge a region:        image_tools.py zoom in.png out.png --box 260 160 300 120 --scale 4
  find    locate an element by a template:  image_tools.py find page.png button.png [--out marked.png]
  sheet   contact sheet of many shots:      image_tools.py sheet test-results/ux out.png --pattern "phone-*.png"
  diff    visual difference with heatmap:   image_tools.py diff before.png after.png diff.png --threshold 0.02
  inspect size, blank or low-contrast check: image_tools.py inspect in.png

Every command prints one JSON line so scripts and tests can read the result.
Exit status: 0 success, 1 check failed (diff above threshold, template not found, blank image), 2 usage error.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Box = tuple[int, int, int, int]


def load_rgb(path: str | Path) -> np.ndarray:
    """RGB array; transparent pixels are composited on white like the page background."""
    with Image.open(path) as im:
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            background = Image.new("RGBA", im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(background, im)
        return np.array(im.convert("RGB"))


def save_rgb(array: np.ndarray, path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array).save(path)


def clamp_box(box: Box, width: int, height: int) -> Box:
    x, y, w, h = box
    if w <= 0 or h <= 0:
        raise ValueError("box width and height must be positive")
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(width, x + w), min(height, y + h)
    if x1 <= x0 or y1 <= y0:
        raise ValueError(f"box {box} is outside the {width}x{height} image")
    return x0, y0, x1 - x0, y1 - y0


def crop(image: np.ndarray, box: Box) -> np.ndarray:
    x, y, w, h = clamp_box(box, image.shape[1], image.shape[0])
    return image[y : y + h, x : x + w].copy()


def zoom(image: np.ndarray, box: Box, scale: float = 3.0, sharp: bool = True) -> np.ndarray:
    """Crop then enlarge. `sharp` keeps pixel edges (good for checking 1 px borders and focus rings)."""
    if not 1 <= scale <= 16:
        raise ValueError("scale must be between 1 and 16")
    part = crop(image, box)
    size = (round(part.shape[1] * scale), round(part.shape[0] * scale))
    return cv2.resize(part, size, interpolation=cv2.INTER_NEAREST if sharp else cv2.INTER_CUBIC)


def find(image: np.ndarray, template: np.ndarray, min_score: float = 0.9) -> dict:
    """Best template match (normalised cross-correlation on grayscale)."""
    if template.shape[0] > image.shape[0] or template.shape[1] > image.shape[1]:
        raise ValueError("template is larger than the image")
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    tmpl = cv2.cvtColor(template, cv2.COLOR_RGB2GRAY)
    scores = cv2.matchTemplate(gray, tmpl, cv2.TM_CCOEFF_NORMED)
    _, best, _, (x, y) = cv2.minMaxLoc(scores)
    return {"found": bool(best >= min_score), "score": round(float(best), 4), "box": [int(x), int(y), int(tmpl.shape[1]), int(tmpl.shape[0])]}


def mark(image: np.ndarray, box: Box, color: tuple[int, int, int] = (230, 30, 30)) -> np.ndarray:
    out = image.copy()
    x, y, w, h = box
    cv2.rectangle(out, (x, y), (x + w - 1, y + h - 1), color, 3)
    return out


def diff(before: np.ndarray, after: np.ndarray, noise: int = 24) -> tuple[float, np.ndarray, list[list[int]]]:
    """Share of changed pixels, a heatmap overlay, and bounding boxes of changed regions.

    Images of different sizes are compared on their common top-left area; the extra area counts as changed.
    """
    h, w = min(before.shape[0], after.shape[0]), min(before.shape[1], after.shape[1])
    a, b = before[:h, :w], after[:h, :w]
    delta = cv2.cvtColor(cv2.absdiff(a, b), cv2.COLOR_RGB2GRAY)
    _, changed = cv2.threshold(delta, noise, 255, cv2.THRESH_BINARY)
    changed = cv2.dilate(changed, np.ones((3, 3), np.uint8))
    total = max(before.shape[0] * before.shape[1], after.shape[0] * after.shape[1])
    ratio = (int(np.count_nonzero(changed)) + (total - h * w)) / total
    contours, _ = cv2.findContours(changed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = sorted(([int(v) for v in cv2.boundingRect(c)] for c in contours), key=lambda r: -r[2] * r[3])[:20]
    heat = b.copy()
    overlay = np.zeros_like(heat)
    overlay[changed > 0] = (255, 0, 0)
    heat = cv2.addWeighted(heat, 1.0, overlay, 0.55, 0)
    for x, y, bw, bh in boxes:
        cv2.rectangle(heat, (x, y), (x + bw - 1, y + bh - 1), (255, 0, 0), 2)
    return round(ratio, 6), heat, boxes


def sheet(paths: list[Path], width: int = 320, columns: int = 4) -> np.ndarray:
    """Contact sheet: thumbnails (top of each page) with their file names."""
    if not paths:
        raise ValueError("no images to put on the sheet")
    label_h, pad = 22, 10
    thumbs = []
    for p in paths:
        img = load_rgb(p)
        scale = width / img.shape[1]
        thumb = cv2.resize(img, (width, max(1, round(img.shape[0] * scale))), interpolation=cv2.INTER_AREA)
        thumbs.append((p.name, thumb[: round(width * 1.6)]))
    cell_h = max(t.shape[0] for _, t in thumbs) + label_h
    rows = (len(thumbs) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * (width + pad) + pad, rows * (cell_h + pad) + pad), (240, 242, 245))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for i, (name, thumb) in enumerate(thumbs):
        x = pad + (i % columns) * (width + pad)
        y = pad + (i // columns) * (cell_h + pad)
        draw.text((x, y + 4), name, fill=(27, 34, 48), font=font)
        canvas.paste(Image.fromarray(thumb), (x, y + label_h))
    return np.array(canvas)


def inspect(image: np.ndarray) -> dict:
    """Catches blank captures (a page that had not rendered) and very low contrast."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    return {
        "width": int(image.shape[1]),
        "height": int(image.shape[0]),
        "mean": round(float(gray.mean()), 2),
        "contrast": round(float(gray.std()), 2),
        "blank": bool(gray.std() < 2.0),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    box_args = {"nargs": 4, "type": int, "metavar": ("X", "Y", "W", "H"), "required": True}

    p = sub.add_parser("crop")
    p.add_argument("input"), p.add_argument("output"), p.add_argument("--box", **box_args)
    p = sub.add_parser("zoom")
    p.add_argument("input"), p.add_argument("output"), p.add_argument("--box", **box_args)
    p.add_argument("--scale", type=float, default=3.0), p.add_argument("--smooth", action="store_true")
    p = sub.add_parser("find")
    p.add_argument("input"), p.add_argument("template"), p.add_argument("--min-score", type=float, default=0.9), p.add_argument("--out")
    p = sub.add_parser("sheet")
    p.add_argument("folder"), p.add_argument("output"), p.add_argument("--pattern", default="*.png")
    p.add_argument("--width", type=int, default=320), p.add_argument("--columns", type=int, default=4)
    p = sub.add_parser("diff")
    p.add_argument("before"), p.add_argument("after"), p.add_argument("output")
    p.add_argument("--threshold", type=float, default=0.02), p.add_argument("--noise", type=int, default=24)
    p = sub.add_parser("inspect")
    p.add_argument("input")

    args = parser.parse_args(argv)
    try:
        if args.command == "crop":
            out = crop(load_rgb(args.input), tuple(args.box))
            save_rgb(out, args.output)
            result, ok = {"output": args.output, "size": [out.shape[1], out.shape[0]]}, True
        elif args.command == "zoom":
            out = zoom(load_rgb(args.input), tuple(args.box), args.scale, sharp=not args.smooth)
            save_rgb(out, args.output)
            result, ok = {"output": args.output, "size": [out.shape[1], out.shape[0]]}, True
        elif args.command == "find":
            image = load_rgb(args.input)
            result = find(image, load_rgb(args.template), args.min_score)
            ok = result["found"]
            if args.out and ok:
                save_rgb(mark(image, tuple(result["box"])), args.out)
        elif args.command == "sheet":
            paths = sorted(Path(args.folder).glob(args.pattern))
            save_rgb(sheet(paths, args.width, args.columns), args.output)
            result, ok = {"output": args.output, "images": len(paths)}, True
        elif args.command == "diff":
            ratio, heat, boxes = diff(load_rgb(args.before), load_rgb(args.after), args.noise)
            save_rgb(heat, args.output)
            ok = ratio <= args.threshold
            result = {"changed": ratio, "threshold": args.threshold, "regions": boxes, "output": args.output}
        else:
            result = inspect(load_rgb(args.input))
            ok = not result["blank"]
    except (ValueError, FileNotFoundError, OSError) as error:
        print(json.dumps({"error": str(error)}))
        return 2
    print(json.dumps({"command": args.command, "ok": ok, **result}))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
