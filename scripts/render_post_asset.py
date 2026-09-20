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


def render_post(hook_lines, highlight_word, sub_text, cta_text, subcta_text, handle_text, output_path,
                 canvas_size=None, bottom_safe=110):
    """hook_lines: lista de 1-2 strings (el corte de línea se respeta tal cual).
    highlight_word: palabra dentro de la ÚLTIMA línea del hook que va en magenta
    (debe aparecer al final de esa línea). Puede ser None.

    canvas_size/bottom_safe: permiten reusar este mismo layout para Stories
    (1080x1920, con más margen inferior para no quedar tapado por la barra
    de respuesta nativa de Instagram) sin duplicar todo el dibujo."""
    W, H = canvas_size or (globals()["W"], globals()["H"])
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
    subcta_extra = GAP_CTA_SUBCTA + 40 if subcta_text else 0
    total_h = hook_block_h + GAP_HOOK_SUB + sub_block_h + GAP_SUB_CTA + pill_h + subcta_extra
    start_y = max(bottom_safe, (H - bottom_safe - total_h) // 2)

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

    if subcta_text:
        y = pill_y1 + GAP_CTA_SUBCTA
        draw.text((MARGIN, y), subcta_text, font=f_subcta, fill=LIGHT_BLUE)

    f_handle = text_font(26, "Regular")
    draw.text((MARGIN, H - min(66, bottom_safe)), handle_text, font=f_handle, fill=WHITE)

    img.save(output_path)
    return output_path


def render_big_stat(stat_text, sub_text, cta_text, subcta_text, handle_text, output_path,
                     canvas_size=None, bottom_safe=110, accent_glyph=None):
    """Estilo 'dato/número protagonista' — el mismo lenguaje del slide
    'stat' de carrusel, llevado a post/Story completos: un bloque magenta
    grande domina el cuadro en vez del stack centrado de render_post.
    accent_glyph (ej. '?'): watermark grande y tenue en una esquina, para
    la variante 'pregunta directa' de Stories — mismo layout, otro énfasis."""
    W, H = canvas_size or (globals()["W"], globals()["H"])
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        r = round(NAVY[0] + (NAVY_DEEP[0] - NAVY[0]) * t)
        g = round(NAVY[1] + (NAVY_DEEP[1] - NAVY[1]) * t)
        b = round(NAVY[2] + (NAVY_DEEP[2] - NAVY[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    draw.rectangle([0, 0, 14, H], fill=MAGENTA)
    max_w = W - 2 * MARGIN

    if accent_glyph:
        f_glyph = display_font(int(W * 0.6), "Black")
        bbox = draw.textbbox((0, 0), accent_glyph, font=f_glyph)
        gw = bbox[2] - bbox[0]
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        odraw = ImageDraw.Draw(overlay)
        odraw.text((W - gw - bbox[0] - 20, H - int(W * 0.62)), accent_glyph, font=f_glyph, fill=(255, 255, 255, 20))
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(img)

    f_stat, stat_lines, _ = fit_font_multi(draw, stat_text, max_w, 160, min_size=72)
    line_h = int(f_stat.size * 1.05)
    block_pad = 60
    block_h = line_h * len(stat_lines) + block_pad * 2

    f_sub = text_font(38, "Medium")
    sub_lines = wrap_text(draw, sub_text, f_sub, max_w) if sub_text else []
    sub_line_h = 52

    f_cta = display_font(48, "ExtraBold")
    bbox_cta = draw.textbbox((0, 0), cta_text, font=f_cta)
    cta_w, cta_h = bbox_cta[2] - bbox_cta[0], bbox_cta[3] - bbox_cta[1]
    pad_x, pad_y = 56, 34
    pill_w, pill_h = cta_w + pad_x * 2, cta_h + pad_y * 2

    total_h = block_h + 50 + len(sub_lines) * sub_line_h + 50 + pill_h
    y = max(bottom_safe, (H - bottom_safe - total_h) // 2)

    draw.rounded_rectangle([MARGIN, y, W - MARGIN, y + block_h], radius=32, fill=MAGENTA)
    ty = y + block_pad
    for line in stat_lines:
        bbox = draw.textbbox((0, 0), line, font=f_stat)
        lw = bbox[2] - bbox[0]
        draw.text((MARGIN + (max_w - lw) / 2, ty), line, font=f_stat, fill=WHITE)
        ty += line_h
    y += block_h + 50

    for line in sub_lines:
        bbox = draw.textbbox((0, 0), line, font=f_sub)
        lw = bbox[2] - bbox[0]
        draw.text((MARGIN + (max_w - lw) / 2, y), line, font=f_sub, fill=LIGHT_BLUE)
        y += sub_line_h
    y += 50

    pill_x0 = MARGIN + (max_w - pill_w) / 2
    draw.rounded_rectangle([pill_x0, y, pill_x0 + pill_w, y + pill_h], radius=pill_h // 2, fill=WHITE)
    draw.text((pill_x0 + pad_x, y + pad_y - bbox_cta[1]), cta_text, font=f_cta, fill=NAVY)
    if subcta_text:
        f_subcta = text_font(32, "Medium")
        sy = y + pill_h + 34
        bbox = draw.textbbox((0, 0), subcta_text, font=f_subcta)
        sw = bbox[2] - bbox[0]
        draw.text((MARGIN + (max_w - sw) / 2, sy), subcta_text, font=f_subcta, fill=LIGHT_BLUE)

    f_handle = text_font(26, "Regular")
    hbbox = draw.textbbox((0, 0), handle_text, font=f_handle)
    hw = hbbox[2] - hbbox[0]
    draw.text(((W - hw) / 2, H - min(66, bottom_safe)), handle_text, font=f_handle, fill=WHITE)

    img.save(output_path)
    return output_path


def render_editorial(eyebrow_text, headline_lines, body_text, cta_text, subcta_text, handle_text, output_path,
                      canvas_size=None, bottom_safe=110):
    """Estilo 'editorial/revista' — composición asimétrica a propósito,
    para que no todo el feed se vea como el mismo stack centrado: eyebrow
    arriba a la izquierda, título grande alineado a la izquierda, bloque
    de acento en la esquina superior derecha, cuerpo corto, CTA abajo."""
    W, H = canvas_size or (globals()["W"], globals()["H"])
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        r = round(NAVY[0] + (NAVY_DEEP[0] - NAVY[0]) * t)
        g = round(NAVY[1] + (NAVY_DEEP[1] - NAVY[1]) * t)
        b = round(NAVY[2] + (NAVY_DEEP[2] - NAVY[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    corner = int(W * 0.32)
    draw.polygon([(W - corner, 0), (W, 0), (W, corner)], fill=MAGENTA)
    draw.rectangle([0, 0, 14, H], fill=MAGENTA)
    max_w = W - 2 * MARGIN

    f_eyebrow = text_font(30, "Bold")
    y = bottom_safe
    draw.text((MARGIN, y), eyebrow_text.upper(), font=f_eyebrow, fill=MAGENTA)
    y += 56

    f_headline, lines, size = fit_font_multi(draw, "\n".join(headline_lines), max_w, 84, min_size=52)
    line_h = int(size * 1.12)
    for raw_line in headline_lines:
        for wrapped in wrap_text(draw, raw_line, f_headline, max_w):
            draw.text((MARGIN, y), wrapped, font=f_headline, fill=WHITE)
            y += line_h
    y += 40

    f_body = text_font(38, "Medium")
    for line in wrap_text(draw, body_text, f_body, max_w):
        draw.text((MARGIN, y), line, font=f_body, fill=LIGHT_BLUE)
        y += 52
    y += 40

    f_cta = display_font(46, "ExtraBold")
    bbox_cta = draw.textbbox((0, 0), cta_text, font=f_cta)
    cta_w, cta_h = bbox_cta[2] - bbox_cta[0], bbox_cta[3] - bbox_cta[1]
    pad_x, pad_y = 50, 30
    pill_w, pill_h = cta_w + pad_x * 2, cta_h + pad_y * 2
    draw.rounded_rectangle([MARGIN, y, MARGIN + pill_w, y + pill_h], radius=pill_h // 2, fill=MAGENTA)
    draw.text((MARGIN + pad_x, y + pad_y - bbox_cta[1]), cta_text, font=f_cta, fill=WHITE)
    y += pill_h + 30
    if subcta_text:
        f_subcta = text_font(32, "Medium")
        draw.text((MARGIN, y), subcta_text, font=f_subcta, fill=LIGHT_BLUE)

    f_handle = text_font(26, "Regular")
    draw.text((MARGIN, H - min(66, bottom_safe)), handle_text, font=f_handle, fill=WHITE)

    img.save(output_path)
    return output_path


def fit_font_multi(draw, text, max_width, start_size, weight="Black", min_size=48, step=4):
    """Como wrap_text pero también ajusta el tamaño de fuente para que
    entre en <=3 líneas — usado por los layouts 'protagonista' donde el
    texto es corto pero debe verse grande."""
    lines_in = text.split("\n") if "\n" in text else [text]
    size = start_size
    while size > min_size:
        f = display_font(size, weight)
        all_lines = []
        for raw in lines_in:
            all_lines.extend(wrap_text(draw, raw, f, max_width))
        if len(all_lines) <= 3:
            widest = max(draw.textbbox((0, 0), l, font=f)[2] for l in all_lines)
            if widest <= max_width:
                return f, all_lines, size
        size -= step
    f = display_font(min_size, weight)
    all_lines = []
    for raw in lines_in:
        all_lines.extend(wrap_text(draw, raw, f, max_width))
    return f, all_lines, min_size


def render_story(hook_lines, highlight_word, sub_text, cta_text, subcta_text, handle_text, output_path):
    """Story real (1080x1920) — mismo lenguaje visual que el post, pero con
    más margen arriba/abajo para no quedar tapado por la hora/perfil o la
    barra de respuesta nativa de Instagram. La API no soporta CTAs
    interactivos en Stories (link/poll/sticker) — el CTA acá es solo texto
    ("Escribime X"), igual que ya se documentó en docs/revision-contenido.md."""
    return render_post(
        hook_lines, highlight_word, sub_text, cta_text, subcta_text, handle_text, output_path,
        canvas_size=(1080, 1920), bottom_safe=260,
    )


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
