"""Contact sheet from a folder of frames: sheet.py <frames_dir> <out.jpg> <seconds_per_frame>.
Also used to build before/after composites: sheet.py --pair <before.jpg> <after.jpg> <out.jpg> <title>."""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = None
for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
    if os.path.exists(f):
        FONT = f
        break


def font(size):
    return ImageFont.truetype(FONT, size) if FONT else ImageFont.load_default()


def sheet(src, out, every):
    files = sorted(f for f in os.listdir(src) if f.endswith('.png'))
    frames = [Image.open(os.path.join(src, f)).convert('RGB') for f in files]
    if not frames:
        return
    w = 195
    h = round(frames[0].height * w / frames[0].width)
    cols = min(8, len(frames))
    rows = (len(frames) + cols - 1) // cols
    pad = 6
    img = Image.new('RGB', (cols * (w + pad) + pad, rows * (h + pad + 18) + pad), (24, 24, 28))
    d = ImageDraw.Draw(img)
    for i, fr in enumerate(frames):
        x = pad + (i % cols) * (w + pad)
        y = pad + (i // cols) * (h + pad + 18)
        img.paste(fr.resize((w, h), Image.LANCZOS), (x, y + 18))
        d.text((x + 2, y + 1), f'{i * every:.2f} s', fill=(230, 230, 230), font=font(13))
    img.save(out, quality=82)


def pair(before, after, out, title):
    a = Image.open(before).convert('RGB')
    b = Image.open(after).convert('RGB')
    h = 900
    a = a.resize((round(a.width * h / a.height), h), Image.LANCZOS)
    b = b.resize((round(b.width * h / b.height), h), Image.LANCZOS)
    pad = 24
    top = 64
    img = Image.new('RGB', (a.width + b.width + pad * 3, h + top + pad), (18, 18, 22))
    d = ImageDraw.Draw(img)
    img.paste(a, (pad, top))
    img.paste(b, (pad * 2 + a.width, top))
    d.text((pad, 14), 'BEFORE', fill=(150, 150, 160), font=font(26))
    d.text((pad * 2 + a.width, 14), 'AFTER', fill=(255, 205, 80), font=font(26))
    d.text((img.width - pad - d.textlength(title, font=font(20)), 20), title, fill=(200, 200, 210), font=font(20))
    img.save(out, quality=85)


if __name__ == '__main__':
    if sys.argv[1] == '--pair':
        pair(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    else:
        sheet(sys.argv[1], sys.argv[2], float(sys.argv[3]))
