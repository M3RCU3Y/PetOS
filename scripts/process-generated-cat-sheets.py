"""Turn ImageGen's checkerboard sprite boards into compact RGBA game sheets."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


COLS = 4
ROWS = 4
FRAME = 96
MOTION_FRAMES = 8


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


def extract_motion_frames(source: Path) -> list[Image.Image]:
    """Extract an eight-slot generated strip with one shared scale and baseline."""
    cleaned = extract_alpha(Image.open(source))
    width, height = cleaned.size
    sprites: list[Image.Image] = []
    boxes: list[tuple[int, int, int, int]] = []
    for index in range(MOTION_FRAMES):
        left = round(index * width / MOTION_FRAMES)
        right = round((index + 1) * width / MOTION_FRAMES)
        sprite = keep_largest_sprite(cleaned.crop((left, 0, right, height)))
        box = sprite.getchannel("A").getbbox()
        if box is None:
            raise ValueError(f"empty motion frame {index} in {source}")
        sprites.append(sprite)
        boxes.append(box)

    max_width = max(right - left for left, _, right, _ in boxes)
    max_height = max(bottom - top for _, top, _, bottom in boxes)
    shared_scale = min((FRAME - 10) / max_width, (FRAME - 10) / max_height)
    output: list[Image.Image] = []
    for sprite, box in zip(sprites, boxes):
        cropped = sprite.crop(box)
        target = (
            max(1, round(cropped.width * shared_scale)),
            max(1, round(cropped.height * shared_scale)),
        )
        resized = cropped.resize(target, Image.Resampling.LANCZOS)
        alpha = resized.getchannel("A").point(lambda value: 0 if value < 28 else 255 if value > 224 else value)
        colors = resized.convert("RGB").quantize(colors=72, method=Image.Quantize.FASTOCTREE).convert("RGB")
        colors.putalpha(alpha)
        frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        x = round((FRAME - colors.width) / 2)
        y = FRAME - 5 - colors.height
        frame.alpha_composite(colors, (x, y))
        output.append(frame)
    return output


def process_motion(idle_source: Path, walk_source: Path, destination: Path) -> None:
    sheet = Image.new("RGBA", (MOTION_FRAMES * FRAME, 2 * FRAME), (0, 0, 0, 0))
    for row, source in enumerate((idle_source, walk_source)):
        for column, frame in enumerate(extract_motion_frames(source)):
            sheet.alpha_composite(frame, (column * FRAME, row * FRAME))
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, optimize=True)
    visible = sum(1 for alpha in sheet.getchannel("A").get_flattened_data() if alpha)
    print(f"wrote {destination} ({sheet.width}x{sheet.height}, {visible} visible pixels)")


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
    parser.add_argument("--walk-source", type=Path)
    args = parser.parse_args()
    if args.walk_source:
        process_motion(args.source, args.walk_source, args.destination)
    else:
        process(args.source, args.destination)


if __name__ == "__main__":
    main()
