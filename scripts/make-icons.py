"""
Makes the launcher icon, the adaptive icon foreground, the splash image and the favicon from two pictures of Pango:

  face.png  Pango studio (/studio), Standing, Still, Face crop, captured at 6x on a transparent background
  body.png  the same, Hello, Full body

(Capture them from the web build: `npx expo export --platform web`, serve dist/ with COOP/COEP headers, open /studio
in Playwright with deviceScaleFactor 6, make the page background transparent and screenshot the element labelled
"Pango the pangolin..." with omitBackground.) Then: python3 scripts/make-icons.py face.png body.png

The icon follows the design canvas's Sizes board: the face on guava. The face is placed as a bust, its cut-off neck and
back flush with the bottom and right edges, so no cut shows; on the adaptive icon those edges sit outside the part the
launcher shows (roughly the middle 72 of 108 dp) and the nose stays inside a circle mask.
"""
import sys

from PIL import Image

GUAVA = (0xFF, 0x5D, 0x73, 255)


def trimmed(path):
    im = Image.open(path).convert('RGBA')
    return im.crop(im.getchannel('A').getbbox())


def place(canvas, img, width, right, bottom):
    scale = width / img.size[0]
    im = img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS)
    canvas.alpha_composite(im, (right - im.size[0], bottom - im.size[1]))
    return canvas


def main(face_path, body_path, out='assets'):
    face = trimmed(face_path)
    w, h = face.size
    face = face.crop((0, 0, min(w, int(h * 1.15)), h))  # less of the back, so the bust is nearly square

    icon = place(Image.new('RGBA', (1024, 1024), GUAVA), face, 880, 1024, 1024)
    icon.convert('RGB').save(f'{out}/icon.png')
    icon.resize((48, 48), Image.LANCZOS).convert('RGB').save(f'{out}/favicon.png')
    place(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), face, 620, 920, 860).save(f'{out}/android-icon-foreground.png')

    body = trimmed(body_path)
    scale = 1024 / max(body.size)
    body = body.resize((round(body.size[0] * scale), round(body.size[1] * scale)), Image.LANCZOS)
    splash = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    splash.alpha_composite(body, ((1024 - body.size[0]) // 2, (1024 - body.size[1]) // 2))
    splash.save(f'{out}/splash-icon.png')


if __name__ == '__main__':
    main(*sys.argv[1:3])
