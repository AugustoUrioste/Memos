from PIL import Image, ImageDraw
import math

BG = (23, 26, 33)       # dark slate background
ACCENT = (255, 176, 87)  # warm amber mic

def draw_mic(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # rounded-square background
    radius = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)

    cx = size / 2
    # mic capsule
    cap_w = size * 0.26
    cap_h = size * 0.40
    cap_top = size * 0.20
    cap_bottom = cap_top + cap_h
    d.rounded_rectangle(
        [cx - cap_w / 2, cap_top, cx + cap_w / 2, cap_bottom],
        radius=cap_w / 2,
        fill=ACCENT,
    )

    # mic stand arc (open bracket under the capsule)
    arc_r = size * 0.20
    arc_bbox = [cx - arc_r, cap_bottom - arc_r * 0.55, cx + arc_r, cap_bottom - arc_r * 0.55 + arc_r * 1.5]
    width = max(2, int(size * 0.035))
    d.arc(arc_bbox, start=20, end=160, fill=ACCENT, width=width)

    # stand line
    stand_top = cap_bottom + arc_r * 0.55
    stand_bottom = stand_top + size * 0.10
    d.line([cx, stand_top, cx, stand_bottom], fill=ACCENT, width=width)

    # base line
    base_half = size * 0.09
    d.line([cx - base_half, stand_bottom, cx + base_half, stand_bottom], fill=ACCENT, width=width)

    return img

for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    im = draw_mic(size)
    if name == "apple-touch-icon.png":
        # iOS wants an opaque background, no alpha
        flat = Image.new("RGB", im.size, BG)
        flat.paste(im, mask=im.split()[3])
        flat.save(f"/home/user/memos/icons/{name}")
    else:
        im.save(f"/home/user/memos/icons/{name}")

print("done")
