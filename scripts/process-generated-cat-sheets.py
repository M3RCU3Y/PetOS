"""Turn ImageGen's checkerboard sprite boards into compact RGBA game sheets."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


COLS = 4
ROWS = 4
FRAME = 96


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, _ = pixel
    return min(red, green, blue) >= 218 and max(red, green, blue) - min(red, green, blue) <= 28


def extract_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    queue: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if visited[index] or not is_background(pixels[x, y]):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)

    output = rgba.copy()
    out = output.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if visited[row + x]:
                red, green, blue, _ = out[x, y]
                out[x, y] = (red, green, blue, 0)
    return output


def keep_largest_sprite(frame: Image.Image) -> Image.Image:
    """Drop disconnected shadows and neighboring-frame fragments after slicing."""
    alpha = frame.getchannel("A")
    mask = alpha.load()
    width, height = frame.size
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for start_y in range(height):
        for start_x in range(width):
            start_index = start_y * width + start_x
            if visited[start_index] or mask[start_x, start_y] < 24:
                continue
            visited[start_index] = 1
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            component: list[tuple[int, int]] = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for ny in range(max(0, y - 1), min(height, y + 2)):
                    for nx in range(max(0, x - 1), min(width, x + 2)):
                        index = ny * width + nx
                        if not visited[index] and mask[nx, ny] >= 24:
                            visited[index] = 1
                            queue.append((nx, ny))
            components.append(component)

    if not components:
        return frame
    largest = set(max(components, key=len))
    cleaned = frame.copy()
    cleaned_alpha = cleaned.getchannel("A")
    cleaned_mask = cleaned_alpha.load()
    for y in range(height):
        for x in range(width):
            if (x, y) not in largest:
                cleaned_mask[x, y] = 0
    cleaned.putalpha(cleaned_alpha)
    return cleaned


def process(source: Path, destination: Path) -> None:
    cleaned = extract_alpha(Image.open(source))
    width, height = cleaned.size
    sheet = Image.new("RGBA", (COLS * FRAME, ROWS * FRAME), (0, 0, 0, 0))

    for row in range(ROWS):
        top = round(row * height / ROWS)
        bottom = round((row + 1) * height / ROWS)
        for col in range(COLS):
            left = round(col * width / COLS)
            right = round((col + 1) * width / COLS)
            frame = cleaned.crop((left, top, right, bottom)).resize((FRAME, FRAME), Image.Resampling.LANCZOS)
            frame = keep_largest_sprite(frame)
            alpha = frame.getchannel("A").point(lambda value: 0 if value < 24 else 255 if value > 224 else value)
            colors = frame.convert("RGB").quantize(colors=64, method=Image.Quantize.FASTOCTREE).convert("RGB")
            colors.putalpha(alpha)
            sheet.alpha_composite(colors, (col * FRAME, row * FRAME))

    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, optimize=True)
    visible = sum(1 for alpha in sheet.getchannel("A").get_flattened_data() if alpha)
    print(f"wrote {destination} ({sheet.width}x{sheet.height}, {visible} visible pixels)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    process(args.source, args.destination)


if __name__ == "__main__":
    main()
