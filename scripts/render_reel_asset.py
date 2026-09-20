"""Reel Engine V3 — genera un Reel real (1080x1920, MP4) a partir de una
lista de "beats" (unidades de 1-3 segundos), no de 3 escenas estáticas.

Reglas generales del motor (aplican a CUALQUIER Reel, no a uno puntual):
- Cambio visual cada 1-3 segundos: cada beat tiene su propio layout y
  una entrada tipo "pop" rápida (~0.25-0.35s), no fades lentos.
- Fondo con paneo/zoom continuo + un acento circular con blur que cambia
  de posición por beat, para que nunca se sienta una placa fija.
- Safe areas reales: nada de texto/CTA entra en la franja superior
  (perfil/hora) ni en la inferior (caption, botones de Reels, nombre de
  usuario) ni en la franja derecha (íconos de like/comentario/compartir).
- Texto secundario más grande y con menos densidad por pantalla — solo
  conceptos, nunca el guion completo.
- Sin audio todavía (ver docs/reel-engine-v3.md) — arquitectura lista
  para sumar voz+música cuando se apruebe el proveedor.

Requiere: Pillow, imageio-ffmpeg (gratis, instalados por pip).
"""

import os
import math
import shutil
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(REPO_ROOT, "assets", "fonts")

W, H = 1080, 1920
FPS = 24
NAVY = (0, 20, 137)
NAVY_DEEP = (0, 12, 92)
MAGENTA = (240, 78, 152)
WHITE = (255, 255, 255)
LIGHT_BLUE = (196, 205, 240)

# Safe areas reales de Instagram Reels (aprox., en px sobre 1080x1920):
# arriba queda tapado por hora/perfil, abajo por caption + controles,
# a la derecha por la columna de like/comentario/compartir/guardar.
SAFE_TOP = 260
SAFE_BOTTOM = 340
SAFE_RIGHT = 150
SAFE_LEFT = 70
SAFE_W = W - SAFE_LEFT - SAFE_RIGHT

BG_W, BG_H = 1350, 2400


def display_font(size, weight="Black"):
    f = ImageFont.truetype(os.path.join(FONT_DIR, "RedHatDisplay[wght].ttf"), size)
    f.set_variation_by_name(weight)
    return f


def text_font(size, weight="Regular"):
    f = ImageFont.truetype(os.path.join(FONT_DIR, "RedHatText[wght].ttf"), size)
    f.set_variation_by_name(weight)
    return f


def ease_out_cubic(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_out_back(t, overshoot=1.9):
    t = max(0.0, min(1.0, t))
    c1 = overshoot
    c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


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


_glow_cache = {}


def glow_blob(cx, cy, radius, color, alpha=70):
    key = (cx, cy, radius, color, alpha)
    if key in _glow_cache:
        return _glow_cache[key]
    size = radius * 2
    blob = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(blob)
    d.ellipse([0, 0, size, size], fill=color + (alpha,))
    blob = blob.filter(ImageFilter.GaussianBlur(radius * 0.35))
    _glow_cache[key] = (blob, cx - radius, cy - radius)
    return _glow_cache[key]


def build_background(progress, beat_index):
    canvas = Image.new("RGB", (BG_W, BG_H), NAVY)
    draw = ImageDraw.Draw(canvas)
    for y in range(BG_H):
        t = y / (BG_H - 1)
        r = round(NAVY[0] + (NAVY_DEEP[0] - NAVY[0]) * t)
        g = round(NAVY[1] + (NAVY_DEEP[1] - NAVY[1]) * t)
        b = round(NAVY[2] + (NAVY_DEEP[2] - NAVY[2]) * t)
        draw.line([(0, y), (BG_W, y)], fill=(r, g, b))
    draw.rectangle([0, 0, 18, BG_H], fill=MAGENTA)

    # Acento circular con blur, cambia de esquina segun el beat -> "cambio
    # de composición" real, no solo el texto se mueve.
    corners = [
        (BG_W * 0.12, BG_H * 0.18), (BG_W * 0.88, BG_H * 0.28),
        (BG_W * 0.15, BG_H * 0.75), (BG_W * 0.85, BG_H * 0.8),
        (BG_W * 0.5, BG_H * 0.15),
    ]
    cx, cy = corners[beat_index % len(corners)]
    canvas = canvas.convert("RGBA")
    blob, bx, by = glow_blob(0, 0, 420, MAGENTA, alpha=55)
    canvas.alpha_composite(blob, (int(cx - 420), int(cy - 420)))
    canvas = canvas.convert("RGB")

    zoom = 1.0 + 0.16 * progress
    zw, zh = int(W * zoom), int(H * zoom)
    max_x, max_y = BG_W - zw, BG_H - zh
    x = int(max_x * 0.5 * (1 + math.sin(progress * math.pi * 1.3 - math.pi / 2)))
    y = int(max_y * progress)
    x = max(0, min(max_x, x))
    y = max(0, min(max_y, y))
    crop = canvas.crop((x, y, x + zw, y + zh)).resize((W, H), Image.LANCZOS)
    return crop


def draw_pop_lines(overlay_draw, lines, font, fill, center_y, line_h, anim, highlight_word=None,
                    highlight_fill=MAGENTA, max_x=None):
    """Texto centrado en el area segura, con pop-in y overshoot leve.
    highlight_word se busca como substring en CUALQUIER línea (no depende
    de dónde cortó el wrap) — bug real encontrado al testear la V1 de esto."""
    scale = 0.85 + 0.15 * anim
    alpha = int(255 * min(1.0, anim / 0.6))
    total_h = line_h * len(lines)
    y = center_y - total_h / 2
    x_center = SAFE_LEFT + (max_x or SAFE_W) / 2
    highlighted_done = False
    for line in lines:
        bbox = overlay_draw.textbbox((0, 0), line, font=font)
        w = (bbox[2] - bbox[0]) * scale
        x = x_center - w / 2
        idx = line.find(highlight_word) if (highlight_word and not highlighted_done) else -1
        if idx >= 0:
            prefix, hl, suffix = line[:idx], line[idx:idx + len(highlight_word)], line[idx + len(highlight_word):]
            cx = x
            for chunk, color in ((prefix, fill), (hl, highlight_fill), (suffix, fill)):
                if not chunk:
                    continue
                overlay_draw.text((cx, y), chunk, font=font, fill=color + (alpha,))
                cbbox = overlay_draw.textbbox((cx, y), chunk, font=font)
                cx = cbbox[2]
            highlighted_done = True
        else:
            overlay_draw.text((x, y), line, font=font, fill=fill + (alpha,))
        y += line_h * scale


def fit_font(draw, text, max_width, start_size, weight="Black", min_size=48, step=4):
    size = start_size
    while size > min_size:
        f = display_font(size, weight)
        lines = wrap_text(draw, text, f, max_width)
        if len(lines) <= 3:
            widest = max(draw.textbbox((0, 0), l, font=f)[2] for l in lines)
            if widest <= max_width:
                return f, lines, size
        size -= step
    f = display_font(min_size, weight)
    return f, wrap_text(draw, text, f, max_width), min_size


def render_reel(beats, cta_text, subcta_text, handle_text, output_path):
    total_duration = sum(b["duration"] for b in beats)
    n_frames = int(total_duration * FPS)
    tmp_dir = tempfile.mkdtemp(prefix="reelv3_frames_")

    # Precomputar limites (tiempo de inicio) de cada beat
    starts = []
    acc = 0.0
    for b in beats:
        starts.append(acc)
        acc += b["duration"]

    probe_draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))

    try:
        for i in range(n_frames):
            t_global = i / FPS
            progress = t_global / total_duration

            beat_idx = 0
            for idx, s in enumerate(starts):
                if t_global >= s:
                    beat_idx = idx
            beat = beats[beat_idx]
            local_t = t_global - starts[beat_idx]
            local_anim = ease_out_back(min(local_t / 0.3, 1.0)) if local_t < 0.3 else 1.0

            frame = build_background(progress, beat_idx).convert("RGBA")
            overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            odraw = ImageDraw.Draw(overlay)

            kind = beat["type"]
            safe_center_y = SAFE_TOP + (H - SAFE_TOP - SAFE_BOTTOM) / 2

            if kind in ("hook", "hook_punch", "line", "question"):
                start_size = 100 if kind == "hook_punch" else 84
                f, lines, _ = fit_font(probe_draw, beat["text"], SAFE_W, start_size)
                line_h = int(_ * 1.12) if False else int(f.size * 1.14)
                draw_pop_lines(
                    odraw, lines, f, WHITE, safe_center_y, line_h, local_anim,
                    highlight_word=beat.get("highlight"),
                )
                if beat.get("sub"):
                    f_sub = text_font(42, "Medium")
                    sub_lines = wrap_text(odraw, beat["sub"], f_sub, SAFE_W)
                    sub_alpha = int(255 * ease_out_cubic(max(0.0, min((local_t - 0.25) / 0.3, 1.0))))
                    sy = safe_center_y + (len(lines) * line_h) / 2 + 40
                    for sl in sub_lines:
                        bbox = odraw.textbbox((0, 0), sl, font=f_sub)
                        sw = bbox[2] - bbox[0]
                        odraw.text(
                            (SAFE_LEFT + (SAFE_W - sw) / 2, sy), sl, font=f_sub,
                            fill=LIGHT_BLUE + (sub_alpha,),
                        )
                        sy += 54

            elif kind == "stat":
                f_stat, stat_lines, _ = fit_font(probe_draw, beat["text"], SAFE_W, 108, min_size=64)
                line_h = int(f_stat.size * 1.1)
                # Barra "resaltador" detras del texto principal
                stat_w = max(odraw.textbbox((0, 0), l, font=f_stat)[2] for l in stat_lines)
                bar_alpha = int(160 * min(1.0, local_anim))
                bar_y0 = safe_center_y - (len(stat_lines) * line_h) / 2 - 10
                bar_h = len(stat_lines) * line_h + 20
                odraw.rounded_rectangle(
                    [SAFE_LEFT + (SAFE_W - stat_w) / 2 - 24, bar_y0, SAFE_LEFT + (SAFE_W + stat_w) / 2 + 24,
                     bar_y0 + bar_h],
                    radius=18, fill=MAGENTA + (bar_alpha,),
                )
                draw_pop_lines(odraw, stat_lines, f_stat, WHITE, safe_center_y, line_h, local_anim)
                if beat.get("sub"):
                    f_sub = text_font(44, "Medium")
                    sub_alpha = int(255 * ease_out_cubic(max(0.0, min((local_t - 0.3) / 0.3, 1.0))))
                    sy = safe_center_y + (len(stat_lines) * line_h) / 2 + 50
                    for sl in wrap_text(odraw, beat["sub"], f_sub, SAFE_W):
                        bbox = odraw.textbbox((0, 0), sl, font=f_sub)
                        sw = bbox[2] - bbox[0]
                        odraw.text((SAFE_LEFT + (SAFE_W - sw) / 2, sy), sl, font=f_sub, fill=WHITE + (sub_alpha,))
                        sy += 58

            elif kind == "cta":
                pop = ease_out_back(min(local_t / 0.35, 1.0))
                f_cta = display_font(52, "ExtraBold")
                bbox_cta = odraw.textbbox((0, 0), cta_text, font=f_cta)
                cta_w, cta_h = bbox_cta[2] - bbox_cta[0], bbox_cta[3] - bbox_cta[1]
                pad_x, pad_y = 58, 36
                pill_w, pill_h = cta_w + pad_x * 2, cta_h + pad_y * 2
                s = min(pop, 1.12)
                scaled_w, scaled_h = pill_w * s, pill_h * s
                px0 = SAFE_LEFT + (SAFE_W - scaled_w) / 2
                py0 = safe_center_y - scaled_h / 2
                alpha = int(255 * min(1.0, local_t / 0.2 + 0.001))
                odraw.rounded_rectangle(
                    [px0, py0, px0 + scaled_w, py0 + scaled_h], radius=scaled_h / 2, fill=MAGENTA + (alpha,),
                )
                if pop > 0.55:
                    text_alpha = max(0, int(255 * ease_out_cubic(min((local_t - 0.12) / 0.25, 1.0))))
                    odraw.text(
                        (px0 + (scaled_w - cta_w) / 2, py0 + (scaled_h - cta_h) / 2 - bbox_cta[1]),
                        cta_text, font=f_cta, fill=WHITE + (text_alpha,),
                    )
                sub_alpha = int(255 * ease_out_cubic(max(0.0, min((local_t - 0.4) / 0.3, 1.0))))
                if sub_alpha > 0 and subcta_text:
                    f_sub = text_font(40, "Medium")
                    sy = py0 + scaled_h + 50
                    for sl in wrap_text(odraw, subcta_text, f_sub, SAFE_W):
                        bbox = odraw.textbbox((0, 0), sl, font=f_sub)
                        sw = bbox[2] - bbox[0]
                        odraw.text(
                            (SAFE_LEFT + (SAFE_W - sw) / 2, sy), sl, font=f_sub, fill=LIGHT_BLUE + (sub_alpha,),
                        )
                        sy += 54

            frame = Image.alpha_composite(frame, overlay)

            fdraw = ImageDraw.Draw(frame)
            f_handle = text_font(30, "Regular")
            hbbox = fdraw.textbbox((0, 0), handle_text, font=f_handle)
            hw = hbbox[2] - hbbox[0]
            fdraw.text(((W - hw) / 2, H - SAFE_BOTTOM + 40), handle_text, font=f_handle, fill=WHITE)

            frame.convert("RGB").save(os.path.join(tmp_dir, f"frame_{i:05d}.png"))

        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [
            ffmpeg_bin, "-y",
            "-framerate", str(FPS),
            "-i", os.path.join(tmp_dir, "frame_%05d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg fallo: {result.stderr[-2000:]}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return output_path, total_duration


if __name__ == "__main__":
    beats = [
        {"type": "question", "text": "¿SOS MONOTRIBUTISTA Y NO SABÉS EN QUÉ CATEGORÍA ESTÁS?",
         "highlight": "CATEGORÍA", "duration": 2.6},
        {"type": "stat", "text": "UNA PARTE DE TU CUOTA", "sub": "va directo a tu cobertura médica.",
         "duration": 2.4},
        {"type": "line", "text": "Y la mayoría no sabe", "sub": "cuánto es, ni qué puede hacer con eso.",
         "duration": 2.6},
        {"type": "hook_punch", "text": "PODÉS SABERLO EN 2 MINUTOS.", "highlight": "MINUTOS.", "duration": 2.0},
        {"type": "cta", "duration": 3.2},
    ]
    out, dur = render_reel(
        beats,
        cta_text="Escribime PLAN",
        subcta_text="y vemos qué te conviene según tu categoría.",
        handle_text="@simoonhaddad · Asesor Federada Salud",
        output_path=os.path.join(REPO_ROOT, "assets", "generated", "reel-monotributo-cobertura.mp4"),
    )
    print("listo", out, f"{dur:.1f}s")
