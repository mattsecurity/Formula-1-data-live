#!/usr/bin/env python3
"""Restore bundled Poly Haven 1K maps; no API requests are made by the app.

Requires Python 3 and curl. Existing files matching manifest.json are cached.
Use --check to verify the checked-in files without making network requests.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "textures"
ASSETS = ("asphalt_02", "aerial_grass_rock", "aerial_beach_01")
MAPS = {"color": "Diffuse", "normal": "nor_gl", "roughness": "Rough"}


def curl(url, output=None):
    args = ["curl", "--fail", "--location", "--silent", "--show-error",
            "--retry", "2", "--connect-timeout", "15", "--max-time", "90", url]
    if output:
        args += ["--output", str(output)]
    return subprocess.check_output(args)


def matches(path, expected):
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == expected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="offline checksum verification")
    options = parser.parse_args()
    manifest = json.loads((DEST / "manifest.json").read_text())
    missing = []
    for asset in ASSETS:
        metadata = None
        for suffix, channel in MAPS.items():
            filename = f"{asset}-{suffix}.jpg"
            path = DEST / filename
            expected = manifest[filename]
            if matches(path, expected):
                print(f"OK {filename}")
                continue
            if options.check:
                missing.append(filename)
                continue
            if metadata is None:
                metadata = json.loads(curl(f"https://api.polyhaven.com/files/{asset}"))
            url = metadata[channel]["1k"]["jpg"]["url"]
            # Keep the last valid file intact if transfer or validation fails.
            with tempfile.TemporaryDirectory(dir=DEST) as tmp:
                download = Path(tmp) / filename
                curl(url, download)
                if not matches(download, expected):
                    raise SystemExit(f"Checksum mismatch: {filename}; review upstream changes before updating the manifest")
                download.replace(path)
            print(f"Downloaded {filename}")
    if missing:
        raise SystemExit("Missing or changed textures: " + ", ".join(missing))


if __name__ == "__main__":
    main()
