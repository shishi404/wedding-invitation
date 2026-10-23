"""Trace visible monochrome reference border marks into SVG, excluding creatures."""
from pathlib import Path
from collections import defaultdict
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
im = Image.open(ROOT / 'design/reference-cthulhu-awakens.jpg').convert('RGB')


def simplify(points, eps=.65):
    if len(points) < 4:
        return points
    a = np.array(points, dtype=float)
    k = int(np.argmax(((a - a[0]) ** 2).sum(axis=1)))

    def rdp(seq):
        if len(seq) < 3:
            return seq.tolist()
        d = seq[-1] - seq[0]
        den = np.linalg.norm(d)
        dist = (np.linalg.norm(seq - seq[0], axis=1) if den == 0 else
                np.abs(d[0] * (seq[:, 1] - seq[0, 1]) - d[1] * (seq[:, 0] - seq[0, 0])) / den)
        j = int(np.argmax(dist))
        if dist[j] <= eps:
            return [seq[0].tolist(), seq[-1].tolist()]
        return rdp(seq[:j + 1])[:-1] + rdp(seq[j:])

    return rdp(a[:k + 1])[:-1] + rdp(np.concatenate([a[k:], a[:1]]))[:-1]


def trace(box, name, limit=None):
    crop = im.crop(box)
    rgb = np.asarray(crop, dtype=float)
    gray = crop.convert('L')
    g = np.asarray(gray, dtype=float)
    bg = np.asarray(gray.filter(ImageFilter.GaussianBlur(7)), dtype=float)
    # Dark engraved strokes on beige paper; exclude the colored illustration.
    paper = (rgb[:, :, 0] > rgb[:, :, 2] * 1.10) & (rgb[:, :, 1] > rgb[:, :, 2] * 1.04) & (g > 48)
    ink = (bg - g > 5.0) & paper
    if limit is not None:
        ink &= limit(ink.shape)
    clean = Image.fromarray((ink * 255).astype('uint8')).filter(ImageFilter.MedianFilter(3))
    ink = np.asarray(clean) > 127
    h, w = ink.shape
    seen = np.zeros_like(ink)
    for y, x in zip(*np.where(ink)):
        if seen[y, x]:
            continue
        stack = [(int(y), int(x))]
        seen[y, x] = True
        component = []
        while stack:
            cy, cx = stack.pop()
            component.append((cy, cx))
            for dy, dx in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and ink[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if len(component) < 18:
            for cy, cx in component:
                ink[cy, cx] = False
    edges = defaultdict(list)
    for y, x in zip(*np.where(ink)):
        x, y = int(x), int(y)
        if y == 0 or not ink[y - 1, x]:
            edges[(x, y)].append((x + 1, y))
        if x == w - 1 or not ink[y, x + 1]:
            edges[(x + 1, y)].append((x + 1, y + 1))
        if y == h - 1 or not ink[y + 1, x]:
            edges[(x + 1, y + 1)].append((x, y + 1))
        if x == 0 or not ink[y, x - 1]:
            edges[(x, y + 1)].append((x, y))
    paths = []
    while edges:
        start = next(iter(edges))
        p = start
        loop = [start]
        while True:
            nxt = edges[p].pop()
            if not edges[p]:
                del edges[p]
            p = nxt
            if p == start:
                break
            loop.append(p)
            if p not in edges:
                break
        if len(loop) < 8:
            continue
        pts = simplify(loop)
        if len(pts) < 3:
            continue
        # Round only the contour's pixel-step corners while retaining its geometry.
        first = ((pts[-1][0] + pts[0][0]) / 2, (pts[-1][1] + pts[0][1]) / 2)
        path = f'M{first[0]:g},{first[1]:g}'
        for j, (x, y) in enumerate(pts):
            nxt = pts[(j + 1) % len(pts)]
            path += f'Q{x:g},{y:g} {(x+nxt[0])/2:g},{(y+nxt[1])/2:g}'
        paths.append(path + 'Z')
    data = ''.join(paths)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><path fill="#a7b593" fill-rule="evenodd" d="{data}"/></svg>'
    (ROOT / f'assets/{name}.svg').write_text(svg, encoding='utf-8')
    print(name, 'source', box, 'contours', len(paths), 'ink pixels', int(ink.sum()))
    return data


def top_limit(shape):
    y, x = np.indices(shape)
    # Stop before the oval rim and the tentacle crossing the bottom left.
    return (y < 224 - .30 * x) & ((x > 52) | (y < 100))


top = trace((415, 108, 958, 340), 'entry-traced-top', top_limit)
trace((2320, 1100, 2385, 2500), 'entry-traced-side')
# Uniform scale and rotation preserve traced marks when arranging them in margins.
corner = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none">
<!-- Traced from James Bousema, Cthulhu Awakens; see design/entry-tracing.md. -->
<g fill="#a7b593" fill-rule="evenodd" opacity=".76">
<path d="{top}" transform="translate(20 20) scale(.66)"/>
<path d="{top}" transform="translate(20 20) rotate(90) translate(0 -232) scale(.66)" opacity=".7"/>
</g></svg>'''
(ROOT / 'assets/entry-traced-corner.svg').write_text(corner, encoding='utf-8')

# A complete rectangular patch contains no monster, rim, or clipped triangle.
# Reflect at identical edges to obtain a continuous repeating field, rather than
# putting separately cropped fragments in the corners of the page.
tile = trace((470, 115, 780, 245), 'entry-traced-repeat-source')
repeat = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 260">
<!-- Continuous reflected repeat of actual traced reference marks. -->
<defs><path id="lines" fill="#a7b593" fill-rule="evenodd" d="{tile}"/></defs>
<use href="#lines"/><use href="#lines" transform="translate(620 0) scale(-1 1)"/>
<use href="#lines" transform="translate(0 260) scale(1 -1)"/>
<use href="#lines" transform="translate(620 260) scale(-1)"/>
</svg>'''
(ROOT / 'assets/entry-traced-continuous.svg').write_text(repeat, encoding='utf-8')
