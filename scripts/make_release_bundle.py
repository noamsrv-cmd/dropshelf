"""Create user-facing release artifacts and a clean source archive."""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"
VERSION = "1.0.0"
ARCHIVE_ROOT = f"DropShelf-{VERSION}"
EXCLUDED_DIRECTORIES = {
    ".git", ".idea", ".vscode", "node_modules", "dist", "dist-electron",
    "release", "work", "outputs", "coverage", "__pycache__",
}
EXCLUDED_SUFFIXES = {".log", ".tmp", ".pyc"}


def source_files() -> list[Path]:
    files: list[Path] = []
    for candidate in ROOT.rglob("*"):
        relative = candidate.relative_to(ROOT)
        if any(part in EXCLUDED_DIRECTORIES for part in relative.parts):
            continue
        if candidate.is_file() and candidate.suffix.lower() not in EXCLUDED_SUFFIXES:
            files.append(candidate)
    return sorted(files, key=lambda value: value.as_posix().lower())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    obsolete_installer = OUTPUTS / f"DropShelf-Setup-{VERSION}-x64.exe"
    if obsolete_installer.is_file():
        obsolete_installer.unlink()

    artifacts = [
        ROOT / "release" / f"DropShelf-Windows-{VERSION}-x64.exe",
        ROOT / "release" / f"DropShelf-Portable-{VERSION}-x64.exe",
    ]
    for source in artifacts:
        if not source.is_file():
            raise FileNotFoundError(source)
        shutil.copy2(source, OUTPUTS / source.name)

    hero = ROOT / "docs" / "assets" / "hero.png"
    shutil.copy2(hero, OUTPUTS / "DropShelf-GitHub-preview.png")

    archive = OUTPUTS / f"DropShelf-source-{VERSION}.zip"
    with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as bundle:
        for source in source_files():
            relative = source.relative_to(ROOT)
            bundle.write(source, f"{ARCHIVE_ROOT}/{relative.as_posix()}")

    checksummed = sorted(
        [*(OUTPUTS / source.name for source in artifacts), archive],
        key=lambda value: value.name.lower(),
    )
    checksums = "\n".join(f"{sha256(item)}  {item.name}" for item in checksummed) + "\n"
    (OUTPUTS / "SHA256SUMS.txt").write_text(checksums, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
