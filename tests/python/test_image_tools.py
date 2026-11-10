"""Unit tests for scripts/ux/image_tools.py (run: pnpm ux:test)."""

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "ux"))
import image_tools as tools  # noqa: E402


def page(width=200, height=120, color=(250, 250, 250)):
    image = np.full((height, width, 3), color, dtype=np.uint8)
    image[20:40, 30:90] = (47, 91, 211)  # a "button"
    image[60:62, 10:190] = (27, 34, 48)  # a rule
    return image


def run(*argv):
    out = io.StringIO()
    with redirect_stdout(out):
        code = tools.main([str(a) for a in argv])
    return code, json.loads(out.getvalue())


class CropAndZoom(unittest.TestCase):
    def test_crop_returns_the_region_and_clamps_to_the_image(self):
        image = page()
        self.assertEqual(tools.crop(image, (30, 20, 60, 20)).tolist(), image[20:40, 30:90].tolist())
        self.assertEqual(tools.crop(image, (180, 100, 50, 50)).shape, (20, 20, 3))
        with self.assertRaises(ValueError):
            tools.crop(image, (500, 500, 10, 10))
        with self.assertRaises(ValueError):
            tools.crop(image, (0, 0, 0, 10))

    def test_zoom_enlarges_with_sharp_pixels(self):
        zoomed = tools.zoom(page(), (30, 20, 10, 5), scale=4)
        self.assertEqual(zoomed.shape, (20, 40, 3))
        self.assertEqual(set(map(tuple, zoomed.reshape(-1, 3))), {(47, 91, 211)})
        with self.assertRaises(ValueError):
            tools.zoom(page(), (0, 0, 5, 5), scale=40)


class FindAndMark(unittest.TestCase):
    def test_finds_an_element_by_template(self):
        image = page()
        image[25:35, 40:80] = (255, 255, 255)  # label inside the button makes the template distinctive
        result = tools.find(image, image[15:45, 25:95])
        self.assertTrue(result["found"])
        self.assertEqual(result["box"], [25, 15, 70, 30])

    def test_reports_missing_elements(self):
        noise = np.random.default_rng(1).integers(0, 255, (120, 200, 3), dtype=np.uint8)
        pattern = np.zeros((20, 20, 3), dtype=np.uint8)
        pattern[::2, ::2] = 255
        self.assertFalse(tools.find(noise, pattern)["found"])
        with self.assertRaises(ValueError):
            tools.find(page(10, 10), page())


class Diff(unittest.TestCase):
    def test_identical_images_have_no_changes(self):
        ratio, _, boxes = tools.diff(page(), page())
        self.assertEqual(ratio, 0)
        self.assertEqual(boxes, [])

    def test_changed_region_is_measured_and_located(self):
        after = page()
        after[80:100, 120:160] = (179, 38, 30)
        ratio, heat, boxes = tools.diff(page(), after)
        self.assertGreater(ratio, 0.02)
        self.assertLess(ratio, 0.06)
        x, y, w, h = boxes[0]
        self.assertTrue(118 <= x <= 120 and 78 <= y <= 80 and w >= 40 and h >= 20)
        self.assertEqual(heat.shape, after.shape)

    def test_small_rendering_noise_is_ignored_and_size_changes_count(self):
        noisy = page().astype(np.int16) + 8
        self.assertEqual(tools.diff(page(), noisy.clip(0, 255).astype(np.uint8))[0], 0)
        self.assertGreater(tools.diff(page(200, 120), page(200, 150))[0], 0.19)


class SheetAndInspect(unittest.TestCase):
    def test_contact_sheet_and_blank_detection(self):
        with tempfile.TemporaryDirectory() as folder:
            for i in range(5):
                Image.fromarray(page()).save(Path(folder) / f"desktop-{i}.png")
            Image.fromarray(page(color=(0, 0, 0))).save(Path(folder) / "other.png")
            code, result = run("sheet", folder, Path(folder) / "sheet.png", "--pattern", "desktop-*.png", "--width", "100", "--columns", "2")
            self.assertEqual((code, result["images"]), (0, 5))
            with Image.open(Path(folder) / "sheet.png") as im:
                self.assertEqual(im.size[0], 2 * 110 + 10)
            blank = Path(folder) / "blank.png"
            Image.new("RGB", (50, 50), (255, 255, 255)).save(blank)
            self.assertEqual(run("inspect", blank), (1, {"command": "inspect", "ok": False, "width": 50, "height": 50, "mean": 255.0, "contrast": 0.0, "blank": True}))
            self.assertEqual(run("inspect", Path(folder) / "desktop-0.png")[0], 0)

    def test_transparent_screenshots_are_read_on_white(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "clear.png"
            Image.new("RGBA", (4, 4), (0, 0, 0, 0)).save(path)
            self.assertEqual(tools.load_rgb(path)[0, 0].tolist(), [255, 255, 255])


class CommandLine(unittest.TestCase):
    def test_crop_zoom_find_diff_through_the_cli(self):
        with tempfile.TemporaryDirectory() as folder:
            before, after = Path(folder) / "before.png", Path(folder) / "after.png"
            Image.fromarray(page()).save(before)
            changed = page()
            changed[0:120, 0:200] = (10, 10, 10)
            Image.fromarray(changed).save(after)
            self.assertEqual(run("crop", before, Path(folder) / "c.png", "--box", 30, 20, 60, 20)[1]["size"], [60, 20])
            self.assertEqual(run("zoom", before, Path(folder) / "z.png", "--box", 30, 20, 60, 20, "--scale", 2)[1]["size"], [120, 40])
            Image.fromarray(page()[15:45, 25:95]).save(Path(folder) / "t.png")
            code, found = run("find", before, Path(folder) / "t.png", "--out", Path(folder) / "m.png")
            self.assertEqual((code, found["found"]), (0, True))
            self.assertTrue((Path(folder) / "m.png").exists())
            code, result = run("diff", before, after, Path(folder) / "d.png", "--threshold", "0.1")
            self.assertEqual(code, 1)
            self.assertGreater(result["changed"], 0.9)
            self.assertEqual(run("crop", Path(folder) / "missing.png", Path(folder) / "x.png", "--box", 0, 0, 1, 1)[0], 2)


if __name__ == "__main__":
    unittest.main()
