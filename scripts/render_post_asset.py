"""Renderiza un asset de post feed (1080x1350) con la identidad visual
obligatoria de Federada — ver docs/identidad-visual-federada.md.

Referencia/primer uso real: post-error-frecuente-cartilla (20/09/2026).
Pensado para generalizarse en el bloque "Content Rendering Engine V2"
(parámetros por content_piece en vez de valores hardcodeados abajo).

Requiere Pillow (pip3 install Pillow) y las fuentes en assets/fonts/.
"""

import os
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(REPO_ROOT, "assets", "fonts")

W, H = 1080, 1350
NAVY = (0, 20, 137)        # #001489
NAVY_DEEP = (0, 12, 92)
MAGENTA = (240, 78, 152)   # #F04E98
WHITE = (255, 255, 255)
LIGHT_BLUE = (196, 205, 240)
MARGIN = 80


def display_font(size, weight="Black"):
    f = ImageFont.truetype(os.path.join(FONT_DIR, "RedHatDisplay[wght].ttf"), size)
    f.set_variation_by_name(weight)
    return f


def text_font(size, weight="Regular"):
    f = ImageFont.truetype(os.path.join(FONT_DIR, "RedHatText[wght].ttf"), size)
    f.set_variation_by_name(weight)
    return f


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, current = [], ""
    for w in words:
        trial = (current + " " + w).strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def render_post(hook_lines, highlight_word, sub_text, cta_text, subcta_text, handle_text, output_path):
    """hook_lines: lista de 1-2 strings (el corte de línea se respeta tal cual).
    highlight_word: palabra dentro de la ÚLTIMA línea del hook que va en magenta
    (debe aparecer al final de esa línea). Puede ser None."""
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)

    for y in range(H):
        t = y / (H - 1)
        r = round(NAVY[0] + (NAVY_DEEP[0] - NAVY[0]) * t)
        g = round(NAVY[1] + (NAVY_DEEP[1] - NAVY[1]) * t)
        b = round(NAVY[2] + (NAVY_DEEP[2] - NAVY[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    max_w = W - 2 * MARGIN
    draw.rectangle([0, 0, 14, H], fill=MAGENTA)

    size = 100
    while True:
        f_hook = display_font(size, "Black")
        widths = [draw.textbbox((0, 0), line, font=f_hook)[2] for line in hook_lines]
        if max(widths) <= max_w or size <= 40:
            break
        size -= 2
    hook_line_h = int(size * 1.08)
    hook_block_h = hook_line_h * len(hook_lines)

    f_sub = text_font(35, "Medium")
    sub_lines = wrap_text(draw, sub_text, f_sub, max_w)
    sub_line_h = 50
    sub_block_h = sub_line_h * len(sub_lines)

    f_cta = display_font(48, "ExtraBold")
    bbox_cta = draw.textbbox((0, 0), cta_text, font=f_cta)
    cta_text_w, cta_text_h = bbox_cta[2] - bbox_cta[0], bbox_cta[3] - bbox_cta[1]
    pad_x, pad_y = 56, 36
    arrow_size = cta_text_h * 0.55
    arrow_gap = 28
    pill_w = cta_text_w + pad_x * 2 + arrow_gap + arrow_size
    pill_h = cta_text_h + pad_y * 2

    f_subcta = text_font(33, "Medium")

    GAP_HOOK_SUB, GAP_SUB_CTA, GAP_CTA_SUBCTA = 55, 70, 36
    total_h = hook_block_h + GAP_HOOK_SUB + sub_block_h + GAP_SUB_CTA + pill_h + GAP_CTA_SUBCTA + 40
    firma_zone = 110
    start_y = max(110, (H - firma_zone - total_h) // 2)

    y = start_y
    for i, line in enumerate(hook_lines):
        is_last = i == len(hook_lines) - 1
        if is_last and highlight_word and line.endswith(highlight_word):
            prefix = line[: -len(highlight_word)]
            bbox_a = draw.textbbox((MARGIN, y), prefix, font=f_hook)
            draw.text((MARGIN, y), prefix, font=f_hook, fill=WHITE)
            draw.text((bbox_a[2], y), highlight_word, font=f_hook, fill=MAGENTA)
        else:
            draw.text((MARGIN, y), line, font=f_hook, fill=WHITE)
        y += hook_line_h
    y += GAP_HOOK_SUB

    for line in sub_lines:
        draw.text((MARGIN, y), line, font=f_sub, fill=LIGHT_BLUE)
        y += sub_line_h
    y += GAP_SUB_CTA

    pill_x0, pill_y0 = MARGIN, y
    pill_x1, pill_y1 = pill_x0 + pill_w, pill_y0 + pill_h
    draw.rounded_rectangle([pill_x0, pill_y0, pill_x1, pill_y1], radius=pill_h // 2, fill=MAGENTA)
    text_x = pill_x0 + pad_x
    text_y = pill_y0 + pad_y - bbox_cta[1]
    draw.text((text_x, text_y), cta_text, font=f_cta, fill=WHITE)

    arrow_x0 = text_x + cta_text_w + arrow_gap
    arrow_cy = pill_y0 + pill_h / 2
    ah = arrow_size
    draw.polygon(
        [
            (arrow_x0, arrow_cy - ah / 2),
            (arrow_x0, arrow_cy + ah / 2),
            (arrow_x0 + ah * 0.9, arrow_cy),
        ],
        fill=WHITE,
    )

    y = pill_y1 + GAP_CTA_SUBCTA
    draw.text((MARGIN, y), subcta_text, font=f_subcta, fill=LIGHT_BLUE)

    f_handle = text_font(26, "Regular")
    draw.text((MARGIN, H - 66), handle_text, font=f_handle, fill=WHITE)

    img.save(output_path)
    return output_path


if __name__ == "__main__":
    render_post(
        hook_lines=["NO ELIJAS UNA PREPAGA", "SOLO POR EL PRECIO."],
        highlight_word="PRECIO.",
        sub_text=(
            "El problema aparece cuando necesitás usarla y descubrís que ese médico, "
            "clínica o estudio que dabas por hecho no está en tu cartilla."
        ),
        cta_text="Escribime CARTILLA",
        subcta_text="Te ayudo a revisar la tuya, sin costo.",
        handle_text="@simoonhaddad  ·  Asesor Federada Salud, Mendoza",
        output_path=os.path.join(REPO_ROOT, "assets", "generated", "post-error-frecuente-cartilla.png"),
    )
    print("listo")
