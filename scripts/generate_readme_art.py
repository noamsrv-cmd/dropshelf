"""Compose truthful marketing artwork from real DropShelf screenshots."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def gradient(width: int, height: int) -> Image.Image:
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            t = (x / width) * 0.55 + (y / height) * 0.45
            pixels[x, y] = (
                round(14 + 10 * t),
                round(14 + 7 * t),
                round(23 + 20 * t),
            )
    return image.convert("RGBA")


def glow(canvas: Image.Image, box: tuple[int, int, int, int], color: tuple[int, int, int, int], blur: int) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box, fill=color)
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def screenshot_card(source: Path, width: int, angle: float = 0) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", (width + 90, height + 100), (0, 0, 0, 0))
    mask = image.getchannel("A")
    shadow_alpha = Image.new("L", shadow.size, 0)
    shadow_alpha.paste(mask, (45, 30))
    shadow_color = Image.new("RGBA", shadow.size, (0, 0, 0, 185))
    shadow_color.putalpha(shadow_alpha.filter(ImageFilter.GaussianBlur(30)))
    shadow.alpha_composite(shadow_color)
    shadow.alpha_composite(image, (45, 20))
    if angle:
        shadow = shadow.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    return shadow


def pill(draw: ImageDraw.ImageDraw, x: int, y: int, text: str) -> int:
    label_font = font(18, True)
    box = draw.textbbox((0, 0), text, font=label_font)
    width = box[2] - box[0] + 34
    draw.rounded_rectangle((x, y, x + width, y + 39), radius=19, fill=(255, 255, 255, 15), outline=(255, 255, 255, 28), width=1)
    draw.text((x + 17, y + 8), text, font=label_font, fill=(184, 179, 220, 255))
    return width


def main() -> None:
    width, height = 1536, 864
    canvas = gradient(width, height)
    glow(canvas, (770, -260, 1540, 510), (114, 96, 255, 105), 115)
    glow(canvas, (-210, 530, 480, 1120), (255, 103, 171, 38), 125)
    draw = ImageDraw.Draw(canvas)

    icon = Image.open(ASSETS / "app-icon.png").convert("RGBA").resize((118, 118), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, (115, 108))
    draw.text((115, 251), "DropShelf", font=font(82, True), fill=(249, 248, 255, 255))
    draw.text((119, 360), "A temporary shelf for", font=font(34), fill=(180, 176, 199, 255))
    draw.text((119, 407), "anything on your computer.", font=font(34), fill=(180, 176, 199, 255))
    draw.text((119, 488), "Keep it close. Use it anywhere.", font=font(23), fill=(139, 131, 255, 255))

    x = 115
    for label in ("LOCAL FIRST", "DRAG & DROP", "NO ACCOUNT"):
        x += pill(draw, x, 566, label) + 11

    draw.line((119, 670, 585, 670), fill=(255, 255, 255, 22), width=1)
    draw.text((119, 701), "Open source  ·  Private by default", font=font(19), fill=(121, 118, 140, 255))

    welcome = screenshot_card(ASSETS / "screenshot-welcome.png", 350, angle=-3.2)
    shelf = screenshot_card(ASSETS / "screenshot-shelf.png", 440, angle=1.2)
    canvas.alpha_composite(welcome, (750, 72))
    canvas.alpha_composite(shelf, (1015, 5))

    noise = Image.effect_noise((width, height), 8).convert("L")
    noise_layer = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    noise_layer.putalpha(noise.point(lambda value: round(value * 0.035)))
    canvas.alpha_composite(noise_layer)

    canvas.convert("RGB").save(ASSETS / "hero.png", quality=94, optimize=True)


if __name__ == "__main__":
    main()
