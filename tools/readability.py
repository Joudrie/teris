"""Color-vision and grayscale renders of the material lineup, before and after.

    python3 -I tools/readability.py

Reads docs/redesign/{before,after}/lineup@390x844.jpg and writes
docs/redesign/readability/lineup-grid.jpg: rows before/after, columns normal, grayscale,
deuteranopia, protanopia, tritanopia (Machado et al. 2009, severity 1.0).
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = {
    'deuteranopia': np.array([[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]]),
    'protanopia': np.array([[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]),
    'tritanopia': np.array([[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]),
}


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255


def variants(img):
    a = np.asarray(img.convert('RGB')).astype(np.float64)
    out = [('normal', img.convert('RGB'))]
    g = lin(a) @ np.array([0.2126, 0.7152, 0.0722])
    gray = srgb(np.stack([g] * 3, axis=-1)).astype(np.uint8)
    out.append(('grayscale', Image.fromarray(gray)))
    for name, m in M.items():
        sim = srgb(lin(a) @ m.T).astype(np.uint8)
        out.append((name, Image.fromarray(sim)))
    return out


def font(size):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def main():
    rows = []
    for which in ('before', 'after'):
        p = os.path.join(ROOT, 'docs/redesign', which, 'lineup@390x844.jpg')
        img = Image.open(p)
        # Crop to the board area so the materials are large.
        w, h = img.size
        box = (0, int(h * 0.13), w, int(h * 0.86))
        rows.append((which, variants(img.crop(box))))
    tw = 300
    th = round(rows[0][1][0][1].height * tw / rows[0][1][0][1].width)
    pad = 12
    top = 40
    left = 110
    grid = Image.new('RGB', (left + 5 * (tw + pad), top + 2 * (th + pad)), (18, 18, 22))
    d = ImageDraw.Draw(grid)
    for c, (name, _) in enumerate(rows[0][1]):
        d.text((left + c * (tw + pad) + 6, 10), name, fill=(230, 230, 230), font=font(18))
    for r, (which, vs) in enumerate(rows):
        d.text((10, top + r * (th + pad) + th // 2 - 10), which.upper(), fill=(255, 205, 80) if which == 'after' else (150, 150, 160), font=font(18))
        for c, (_, im) in enumerate(vs):
            grid.paste(im.resize((tw, th), Image.LANCZOS), (left + c * (tw + pad), top + r * (th + pad)))
    out = os.path.join(ROOT, 'docs/redesign/readability')
    os.makedirs(out, exist_ok=True)
    grid.save(os.path.join(out, 'lineup-grid.jpg'), quality=86)
    print('wrote', os.path.join(out, 'lineup-grid.jpg'))


if __name__ == '__main__':
    main()
