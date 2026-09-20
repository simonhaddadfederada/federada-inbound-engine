"""Genera un carrusel completo (N slides, 1080x1350 cada una) con la
identidad visual de Federada. Reutiliza las fuentes/paleta de
render_post_asset.py.

Primer uso real: carousel-obra-social-vs-prepaga (20/09/2026).
"""

import os
import sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_post_asset import (  # noqa: E402
    W, H, NAVY, NAVY_DEEP, MAGENTA, WHITE, LIGHT_BLUE, MARGIN,
    display_font, text_font, wrap_text,
)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def render_slide(kind, index, total, title, body_lines, output_path, cta_text=None, subcta_text=None,
                  handle_text=None):
    """kind: 'cover' | 'content' | 'cta'"""
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

    # Contador de slide, arriba a la derecha (salvo en la portada)
    if kind != "cover":
        f_counter = text_font(28, "Medium")
        counter_text = f"{index}/{total}"
        bbox = draw.textbbox((0, 0), counter_text, font=f_counter)
        cw = bbox[2] - bbox[0]
        draw.text((W - MARGIN - cw, 70), counter_text, font=f_counter, fill=LIGHT_BLUE)

    if kind == "cover":
        f_title = display_font(76, "Black")
        lines = wrap_text(draw, title, f_title, max_w)
        line_h = 88
        total_h = line_h * len(lines)
        y = H * 0.38 - total_h / 2
        for line in lines:
            draw.text((MARGIN, y), line, font=f_title, fill=WHITE)
            y += line_h
        f_swipe = text_font(32, "Medium")
        swipe = "Deslizá"
        bbox = draw.textbbox((0, 0), swipe, font=f_swipe)
        sw, sh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        text_x = W - MARGIN - sw - 34
        text_y = H - 100
        draw.text((text_x, text_y), swipe, font=f_swipe, fill=MAGENTA)
        # Flecha dibujada a mano (la fuente no trae el glifo "→")
        ah = sh * 0.8
        ax0 = text_x + sw + 14
        acy = text_y + sh / 2 + bbox[1]
        draw.polygon(
            [(ax0, acy - ah / 2), (ax0, acy + ah / 2), (ax0 + ah * 0.9, acy)],
            fill=MAGENTA,
        )

    elif kind == "content":
        f_title = display_font(56, "ExtraBold")
        title_lines = wrap_text(draw, title, f_title, max_w)
        y = 170
        for line in title_lines:
            draw.text((MARGIN, y), line, font=f_title, fill=MAGENTA)
            y += 66
        y += 30
        f_body = text_font(40, "Medium")
        for para in body_lines:
            wrapped = wrap_text(draw, para, f_body, max_w)
            for line in wrapped:
                draw.text((MARGIN, y), line, font=f_body, fill=WHITE)
                y += 56
            y += 24

    elif kind == "cta":
        f_title = display_font(64, "Black")
        title_lines = wrap_text(draw, title, f_title, max_w)
        line_h = 74
        y = H * 0.28
        for line in title_lines:
            draw.text((MARGIN, y), line, font=f_title, fill=WHITE)
            y += line_h
        y += 50

        f_cta = display_font(46, "ExtraBold")
        bbox_cta = draw.textbbox((0, 0), cta_text, font=f_cta)
        cta_w, cta_h = bbox_cta[2] - bbox_cta[0], bbox_cta[3] - bbox_cta[1]
        pad_x, pad_y = 52, 32
        pill_w, pill_h = cta_w + pad_x * 2, cta_h + pad_y * 2
        draw.rounded_rectangle([MARGIN, y, MARGIN + pill_w, y + pill_h], radius=pill_h // 2, fill=MAGENTA)
        draw.text((MARGIN + pad_x, y + pad_y - bbox_cta[1]), cta_text, font=f_cta, fill=WHITE)
        y += pill_h + 34

        if subcta_text:
            f_sub = text_font(34, "Medium")
            for line in wrap_text(draw, subcta_text, f_sub, max_w):
                draw.text((MARGIN, y), line, font=f_sub, fill=LIGHT_BLUE)
                y += 46

    if handle_text:
        f_handle = text_font(26, "Regular")
        draw.text((MARGIN, H - 66), handle_text, font=f_handle, fill=WHITE)

    img.save(output_path)
    return output_path


if __name__ == "__main__":
    HANDLE = "@simoonhaddad  ·  Asesor Federada Salud, Mendoza"
    slides = [
        dict(kind="cover", title="OBRA SOCIAL vs. PREPAGA: 5 diferencias que nadie te explica"),
        dict(
            kind="content",
            title="¿Quién puede tener cada una?",
            body=[
                "La obra social viene con tu trabajo, en relación de dependencia o monotributo.",
                "La prepaga la podés contratar vos, sea cual sea tu situación laboral.",
            ],
        ),
        dict(
            kind="content",
            title="¿Cómo se financian?",
            body=[
                "La obra social se paga con tus aportes obligatorios del sueldo.",
                "La prepaga se paga con una cuota mensual que vos elegís.",
            ],
        ),
        dict(
            kind="content",
            title="Cartilla y tiempos de espera",
            body=[
                "Cada una tiene sus propios prestadores y tiempos de espera.",
                "Por eso conviene mirar la cartilla ANTES de decidir, no después.",
            ],
        ),
        dict(
            kind="content",
            title="Mito: \"la prepaga siempre es más cara\"",
            body=[
                "Depende de cuánto ya estás aportando.",
                "Muchas veces la diferencia real es menor de lo que pensás.",
            ],
        ),
        dict(
            kind="cta",
            title="¿Cuál te conviene a vos?",
            cta="Comentá INFO",
            subcta="y te ayudo a comparar tu caso puntual.",
        ),
    ]

    total = len(slides)
    out_paths = []
    for i, s in enumerate(slides, start=1):
        out_path = os.path.join(REPO_ROOT, "assets", "generated", f"carousel-obra-social-vs-prepaga-slide-{i}.png")
        render_slide(
            kind=s["kind"],
            index=i,
            total=total,
            title=s["title"],
            body_lines=s.get("body", []),
            output_path=out_path,
            cta_text=s.get("cta"),
            subcta_text=s.get("subcta"),
            handle_text=HANDLE,
        )
        out_paths.append(out_path)
        print("slide", i, "->", out_path)

    print("listo", len(out_paths), "slides")
