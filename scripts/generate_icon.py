"""Generate deterministic PNG and ICO assets from the DropShelf vector mark."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
DOCS = ROOT / "docs" / "assets"


def vertical_gradient(size: int) -> Image.Image:
    top = (170, 165, 255, 255)
    bottom = (104, 94, 232, 255)
    image = Image.new("RGBA", (size, size))
    pixels = image.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        color = tuple(round(top[index] * (1 - t) + bottom[index] * t) for index in range(4))
        for x in range(size):
            pixels[x, y] = color
    return image


def create_icon(size: int = 1024) -> Image.Image:
    scale = size / 1024
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    bounds = tuple(round(value * scale) for value in (82, 76, 942, 936))
    radius = round(258 * scale)
    shadow_draw.rounded_rectangle(bounds, radius=radius, fill=(48, 39, 137, 115))
    shadow = shadow.filter(ImageFilter.GaussianBlur(round(42 * scale)))
    canvas.alpha_composite(shadow)

    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(bounds, radius=radius, fill=255)
    gradient = vertical_gradient(size)
    canvas.alpha_composite(Image.composite(gradient, Image.new("RGBA", canvas.size), mask))

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(tuple(round(v * scale) for v in (286, 326, 738, 430)), radius=round(24 * scale), fill=(255, 255, 255, 252))
    draw.rounded_rectangle(tuple(round(v * scale) for v in (218, 500, 806, 754)), radius=round(128 * scale), fill=(255, 255, 255, 255))
    draw.rectangle(tuple(round(v * scale) for v in (218, 625, 806, 754)), fill=(255, 255, 255, 255))
    draw.rounded_rectangle(tuple(round(v * scale) for v in (380, 575, 644, 641)), radius=round(33 * scale), fill=(131, 122, 250, 255))
    return canvas


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)
    icon = create_icon()
    icon.save(BUILD / "icon.png", optimize=True)
    icon.save(DOCS / "app-icon.png", optimize=True)
    icon.save(BUILD / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


if __name__ == "__main__":
    main()
