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
from icon_assets import composite_icon  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def render_slide(kind, index, total, title, body_lines, output_path, cta_text=None, subcta_text=None,
                  handle_text=None, number=None, icon_key=None):
    """kind: 'cover' | 'content' | 'cta' | 'stat' | 'comparison' | 'listicle'.
    number: solo para 'listicle' — el número que va en la insignia.
    icon_key (Bloque 19, Creative Director V2 — opt-in, None por
    defecto): compone un ícono propio (icon_assets.py) como recurso
    visual, además del texto — nunca reemplaza el layout de texto."""
    img = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        r = round(NAVY[0] + (NAVY_DEEP[0] - NAVY[0]) * t)
        g = round(NAVY[1] + (NAVY_DEEP[1] - NAVY[1]) * t)
        b = round(NAVY[2] + (NAVY_DEEP[2] - NAVY[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    if icon_key:
        img = composite_icon(img, icon_key, W * 0.68, H * 0.32, scale=1.5, alpha=32)
        draw = ImageDraw.Draw(img)
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

    elif kind == "listicle":
        # Insignia numerada + título/cuerpo — para ideas tipo "3
        # preguntas"/"5 cosas", donde el número ES el contenido.
        badge_r = 46
        badge_cy = 210
        draw.ellipse(
            [MARGIN, badge_cy - badge_r, MARGIN + badge_r * 2, badge_cy + badge_r], fill=MAGENTA,
        )
        f_num = display_font(50, "Black")
        num_text = str(number or index)
        nbbox = draw.textbbox((0, 0), num_text, font=f_num)
        nw, nh = nbbox[2] - nbbox[0], nbbox[3] - nbbox[1]
        draw.text(
            (MARGIN + badge_r - nw / 2 - nbbox[0], badge_cy - nh / 2 - nbbox[1]),
            num_text, font=f_num, fill=WHITE,
        )
        text_x = MARGIN + badge_r * 2 + 30
        text_max_w = W - MARGIN - text_x
        f_title = display_font(48, "ExtraBold")
        title_lines = wrap_text(draw, title, f_title, text_max_w)
        y = badge_cy - (len(title_lines) * 56) / 2
        for line in title_lines:
            draw.text((text_x, y), line, font=f_title, fill=WHITE)
            y += 56
        y = badge_cy + badge_r + 50
        f_body = text_font(38, "Medium")
        for para in body_lines:
            for line in wrap_text(draw, para, f_body, max_w):
                draw.text((MARGIN, y), line, font=f_body, fill=LIGHT_BLUE)
                y += 52
            y += 20

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

    elif kind == "stat":
        # Slide de dato/número destacado — variedad visual real frente a
        # "content" (párrafo a la izquierda): número grande centrado
        # sobre un bloque de acento, para que no todas las slides se
        # vean iguales (pedido explícito: nada de "6 placas iguales").
        f_stat = display_font(112, "Black")
        stat_lines = wrap_text(draw, title, f_stat, max_w)
        line_h = 118
        block_h = line_h * len(stat_lines) + 90
        block_y0 = H * 0.32
        draw.rounded_rectangle([MARGIN, block_y0, W - MARGIN, block_y0 + block_h], radius=28, fill=MAGENTA)
        y = block_y0 + 45
        for line in stat_lines:
            bbox = draw.textbbox((0, 0), line, font=f_stat)
            lw = bbox[2] - bbox[0]
            draw.text((MARGIN + (max_w - lw) / 2, y), line, font=f_stat, fill=WHITE)
            y += line_h
        if body_lines:
            f_body = text_font(38, "Medium")
            y = block_y0 + block_h + 50
            for para in body_lines:
                for line in wrap_text(draw, para, f_body, max_w):
                    draw.text((MARGIN, y), line, font=f_body, fill=WHITE)
                    y += 52

    elif kind == "comparison":
        # Dos columnas — para contrastar dos opciones (ej. obra social vs
        # prepaga) en una sola slide en vez de una lista de texto plana.
        f_title = display_font(48, "ExtraBold")
        title_lines = wrap_text(draw, title, f_title, max_w)
        y = 150
        for line in title_lines:
            draw.text((MARGIN, y), line, font=f_title, fill=MAGENTA)
            y += 58
        y += 40
        col_w = (max_w - 50) / 2
        col_x = [MARGIN, MARGIN + col_w + 50]
        draw.line([(W / 2, y), (W / 2, H - 140)], fill=LIGHT_BLUE, width=2)
        f_label = display_font(34, "ExtraBold")
        f_body = text_font(34, "Medium")
        for i, col in enumerate(body_lines[:2]):
            cy = y
            draw.text((col_x[i], cy), col.get("label", ""), font=f_label, fill=WHITE)
            cy += 54
            for line in wrap_text(draw, col.get("text", ""), f_body, col_w):
                draw.text((col_x[i], cy), line, font=f_body, fill=LIGHT_BLUE)
                cy += 46

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
