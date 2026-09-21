"""Biblioteca de iconografía/ilustración propia (Bloque 19 — Creative
Director V2). 100% dibujada con Pillow, cero foto/stock — "assets
propios", una de las categorías explícitamente permitidas sin costo.

Sirve como el recurso visual disponible HOY sin depender de que Simón
cree una cuenta nueva. La integración de fotos reales con licencia
comercial (Pexels, ver stock_photos.py) queda preparada para cuando
exista la API key — ver docs/visual-assets.md.

Cada función dibuja una silueta/ilustración simple centrada en (cx, cy)
con una escala dada, en un ImageDraw ya abierto (se compone sobre el
fondo del layout que la llama, nunca reemplaza el fondo entero).
"""

from PIL import Image, ImageDraw


def draw_person_with_phone(overlay: Image.Image, cx, cy, scale=1.0, color=(255, 255, 255, 40)):
    """Silueta simple: cabeza + torso + un rectángulo de celular en la
    mano — representa 'persona mirando el celular' sin ser una foto real."""
    draw = ImageDraw.Draw(overlay)
    head_r = 60 * scale
    draw.ellipse([cx - head_r, cy - 220 * scale - head_r, cx + head_r, cy - 220 * scale + head_r], fill=color)
    draw.rounded_rectangle(
        [cx - 90 * scale, cy - 140 * scale, cx + 90 * scale, cy + 220 * scale], radius=50 * scale, fill=color,
    )
    phone_w, phone_h = 50 * scale, 96 * scale
    px0 = cx + 95 * scale
    py0 = cy - 100 * scale
    draw.rounded_rectangle(
        [px0, py0, px0 + phone_w, py0 + phone_h], radius=10 * scale, outline=color, width=int(10 * scale),
    )


def draw_document(overlay: Image.Image, cx, cy, scale=1.0, color=(255, 255, 255, 40)):
    """Documento/recibo conceptual: una tarjeta con líneas — nunca un
    documento real de nadie, es una representación genérica."""
    draw = ImageDraw.Draw(overlay)
    w, h = 220 * scale, 280 * scale
    draw.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=16 * scale, fill=color)
    line_color = tuple(list(color[:3]) + [min(255, color[3] + 40)])
    y = cy - h / 2 + 50 * scale
    for i in range(5):
        lw = w * (0.7 if i % 2 == 0 else 0.45)
        draw.rectangle([cx - w / 2 + 24 * scale, y, cx - w / 2 + 24 * scale + lw, y + 14 * scale], fill=line_color)
        y += 36 * scale


def draw_family(overlay: Image.Image, cx, cy, scale=1.0, color=(255, 255, 255, 40)):
    """3 siluetas de distinto tamaño agrupadas — familia, sin representar
    personas reales/específicas."""
    draw = ImageDraw.Draw(overlay)
    for dx, size in ((-110, 0.85), (0, 1.0), (110, 0.65)):
        s = scale * size
        head_r = 55 * s
        bx = cx + dx * scale
        draw.ellipse([bx - head_r, cy - 200 * s - head_r, bx + head_r, cy - 200 * s + head_r], fill=color)
        draw.rounded_rectangle(
            [bx - 80 * s, cy - 130 * s, bx + 80 * s, cy + 200 * s], radius=45 * s, fill=color,
        )


def draw_medical_cross(overlay: Image.Image, cx, cy, scale=1.0, color=(255, 255, 255, 40)):
    """Cruz médica dentro de un círculo — icono genérico de salud, nunca
    un logo real de un prestador/hospital específico."""
    draw = ImageDraw.Draw(overlay)
    r = 130 * scale
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    bar = 34 * scale
    arm = 100 * scale
    bg = (0, 20, 137, 255)
    draw.rectangle([cx - bar / 2, cy - arm / 2, cx + bar / 2, cy + arm / 2], fill=bg)
    draw.rectangle([cx - arm / 2, cy - bar / 2, cx + arm / 2, cy + bar / 2], fill=bg)


ICONS = {
    "persona_celular": draw_person_with_phone,
    "documento": draw_document,
    "familia": draw_family,
    "medico": draw_medical_cross,
}


def composite_icon(base_img, icon_key, cx, cy, scale=1.0, alpha=40, color_rgb=(255, 255, 255)):
    """Compone un ícono de ICONS sobre base_img (RGB o RGBA) y devuelve
    la imagen resultante en RGB. Pensado para usarse como acento visual
    grande y sutil (marca de agua), no como elemento opaco que tape texto."""
    fn = ICONS.get(icon_key)
    if not fn:
        return base_img
    base = base_img.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    fn(overlay, cx, cy, scale=scale, color=color_rgb + (alpha,))
    return Image.alpha_composite(base, overlay).convert("RGB")
