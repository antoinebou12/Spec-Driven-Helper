"""After the Playwright UX tour: contact sheets per device, a zoom of each page's header, and a
blank-capture check (a view screenshotted before it rendered). Run with `pnpm ux:review`."""

import json
import sys
from pathlib import Path

import image_tools as tools

SHOTS = Path("test-results/ux")
OUT = SHOTS / "review"


def main() -> int:
    shots = sorted(p for p in SHOTS.glob("*.png") if p.is_file())
    if not shots:
        print(json.dumps({"ok": False, "error": f"no screenshots in {SHOTS}; run the ux-tour journey first"}))
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"screenshots": len(shots), "blank": [], "low_contrast": [], "sheets": [], "zooms": []}
    for shot in shots:
        image = tools.load_rgb(shot)
        facts = tools.inspect(image)
        if facts["blank"]:
            report["blank"].append(shot.name)
        elif facts["contrast"] < 12:
            report["low_contrast"].append(shot.name)
        # The first 360 px hold the page title and primary actions: enlarge them for a close look.
        width = min(image.shape[1], 1440)
        zoom = tools.zoom(image, (0, 0, width, min(image.shape[0], 360)), scale=2 if width <= 480 else 1, sharp=False)
        target = OUT / f"top-{shot.name}"
        tools.save_rgb(zoom, target)
        report["zooms"].append(str(target))
    for device in ("desktop", "phone"):
        group = [p for p in shots if p.name.startswith(f"{device}-")]
        if group:
            target = OUT / f"sheet-{device}.png"
            tools.save_rgb(tools.sheet(group, width=260 if device == "desktop" else 180, columns=4 if device == "desktop" else 6), target)
            report["sheets"].append(str(target))
    ok = not report["blank"]
    print(json.dumps({"ok": ok, **{k: v for k, v in report.items() if k != "zooms"}, "zooms": len(report["zooms"])}, indent=1))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    sys.exit(main())
