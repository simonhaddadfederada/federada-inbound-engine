"""Genera un Reel real (1080x1920, MP4) con la identidad visual de
Federada, a partir de los campos de una content_piece.

No es un PowerPoint exportado: el fondo hace un paneo/zoom continuo
("Ken Burns") durante todo el video, y cada escena tiene su propia
animación de entrada (fade/slide/scale), no solo cortes estáticos.

V1 sin audio (no se generan clips de audio ni música con estas
herramientas gratuitas) — limitación conocida, documentada.

Requiere: Pillow, imageio-ffmpeg (ambos instalables por pip, gratis).
"""

import os
import math
import shutil
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont
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

# Lienzo de fondo mas grande que el frame final: paneamos/zoomeamos dentro
# de el durante todo el video para que nunca se sienta una placa estatica.
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


def ease_out_back(t):
    t = max(0.0, min(1.0, t))
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def build_background(progress):
    """progress 0..1 a lo largo de TODO el video. Devuelve un frame 1080x1920
    recortado de un lienzo mas grande, paneando en diagonal con leve zoom."""
    canvas = Image.new("RGB", (BG_W, BG_H), NAVY)
    draw = ImageDraw.Draw(canvas)
    for y in range(BG_H):
        t = y / (BG_H - 1)
        r = round(NAVY[0] + (NAVY_DEEP[0] - NAVY[0]) * t)
        g = round(NAVY[1] + (NAVY_DEEP[1] - NAVY[1]) * t)
        b = round(NAVY[2] + (NAVY_DEEP[2] - NAVY[2]) * t)
        draw.line([(0, y), (BG_W, y)], fill=(r, g, b))
    draw.rectangle([0, 0, 18, BG_H], fill=MAGENTA)

    zoom = 1.0 + 0.06 * progress
    zw, zh = int(W * zoom), int(H * zoom)
    max_x, max_y = BG_W - zw, BG_H - zh
    x = int(max_x * 0.5 * (1 + math.sin(progress * math.pi - math.pi / 2)))
    y = int(max_y * progress)
    x = max(0, min(max_x, x))
    y = max(0, min(max_y, y))
    crop = canvas.crop((x, y, x + zw, y + zh)).resize((W, H), Image.LANCZOS)
    return crop


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


def draw_centered_lines(draw, lines, font, fill, center_y, line_h, margin, highlight_last_word=None):
    total_h = line_h * len(lines)
    y = center_y - total_h / 2
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        w = bbox[2] - bbox[0]
        x = (W - w) / 2
        if highlight_last_word and i == len(lines) - 1 and line.endswith(highlight_last_word):
            prefix = line[: -len(highlight_last_word)]
            pbbox = draw.textbbox((x, y), prefix, font=font)
            draw.text((x, y), prefix, font=font, fill=fill)
            draw.text((pbbox[2], y), highlight_last_word, font=font, fill=MAGENTA)
        else:
            draw.text((x, y), line, font=font, fill=fill)
        y += line_h


def render_reel(hook_text, highlight_word, dev_lines, cta_text, subcta_text, handle_text, output_path,
                 scene_durations=(3.2, 5.0, 3.6)):
    total_duration = sum(scene_durations)
    n_frames = int(total_duration * FPS)
    tmp_dir = tempfile.mkdtemp(prefix="reel_frames_")
    margin = 90
    max_w = W - 2 * margin

    try:
        for i in range(n_frames):
            t_global = i / FPS
            progress = t_global / total_duration
            frame = build_background(progress)
            draw = ImageDraw.Draw(frame)

            # --- Escena 1: hook ---
            if t_global < scene_durations[0]:
                local_t = t_global / scene_durations[0]
                anim = ease_out_cubic(min(local_t / 0.35, 1.0))
                size = 88
                f_hook = display_font(size, "Black")
                tmp_draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
                lines = wrap_text(tmp_draw, hook_text, f_hook, max_w)
                while len(lines) > 4 and size > 56:
                    size -= 4
                    f_hook = display_font(size, "Black")
                    lines = wrap_text(tmp_draw, hook_text, f_hook, max_w)
                line_h = int(size * 1.1)
                offset_y = (1 - anim) * 60
                overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                odraw = ImageDraw.Draw(overlay)
                draw_centered_lines(
                    odraw, lines, f_hook, WHITE + (int(255 * anim),), H * 0.42 + offset_y, line_h, margin,
                    highlight_last_word=highlight_word,
                )
                frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")

            # --- Escena 2: desarrollo, lineas escalonadas ---
            elif t_global < scene_durations[0] + scene_durations[1]:
                local_t = (t_global - scene_durations[0]) / scene_durations[1]
                f_dev = text_font(52, "Medium")
                overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                odraw = ImageDraw.Draw(overlay)
                n = len(dev_lines)
                gap = 0.5
                y_positions = []
                block_line_h = 76
                start_y = H * 0.5 - (n * block_line_h) / 2
                for idx, line in enumerate(dev_lines):
                    reveal_at = idx * gap * (1.0 / max(n, 1)) * 1.6
                    local_anim = ease_out_cubic(max(0.0, min((local_t - reveal_at) / 0.25, 1.0)))
                    if local_anim <= 0:
                        continue
                    alpha = int(255 * local_anim)
                    slide = (1 - local_anim) * 40
                    wrapped = wrap_text(odraw, line, f_dev, max_w)
                    ly = start_y + idx * block_line_h + slide
                    for wline in wrapped:
                        bbox = odraw.textbbox((0, 0), wline, font=f_dev)
                        wl = bbox[2] - bbox[0]
                        odraw.text(((W - wl) / 2, ly), wline, font=f_dev, fill=LIGHT_BLUE + (alpha,))
                        ly += 62
                frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")

            # --- Escena 3: CTA ---
            else:
                local_t = (t_global - scene_durations[0] - scene_durations[1]) / scene_durations[2]
                pop = ease_out_back(min(local_t / 0.4, 1.0))
                f_cta = display_font(58, "ExtraBold")
                bbox_cta = draw.textbbox((0, 0), cta_text, font=f_cta)
                cta_w, cta_h = bbox_cta[2] - bbox_cta[0], bbox_cta[3] - bbox_cta[1]
                pad_x, pad_y = 60, 38
                pill_w, pill_h = cta_w + pad_x * 2, cta_h + pad_y * 2
                scaled_w, scaled_h = pill_w * min(pop, 1.15), pill_h * min(pop, 1.15)
                px0 = (W - scaled_w) / 2
                py0 = H * 0.46 - scaled_h / 2
                overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                odraw = ImageDraw.Draw(overlay)
                alpha = int(255 * min(1.0, local_t / 0.2 + 0.001))
                odraw.rounded_rectangle(
                    [px0, py0, px0 + scaled_w, py0 + scaled_h], radius=scaled_h / 2, fill=MAGENTA + (alpha,)
                )
                if pop > 0.6:
                    text_alpha = int(255 * ease_out_cubic(min((local_t - 0.15) / 0.25, 1.0)))
                    text_alpha = max(0, text_alpha)
                    odraw.text(
                        (px0 + (scaled_w - cta_w) / 2, py0 + (scaled_h - cta_h) / 2 - bbox_cta[1]),
                        cta_text, font=f_cta, fill=WHITE + (text_alpha,),
                    )
                sub_alpha = int(255 * ease_out_cubic(max(0.0, min((local_t - 0.45) / 0.3, 1.0))))
                if sub_alpha > 0:
                    f_sub = text_font(38, "Medium")
                    sub_lines = wrap_text(odraw, subcta_text, f_sub, max_w)
                    sy = py0 + scaled_h + 50
                    for line in sub_lines:
                        bbox = odraw.textbbox((0, 0), line, font=f_sub)
                        lw = bbox[2] - bbox[0]
                        odraw.text(((W - lw) / 2, sy), line, font=f_sub, fill=LIGHT_BLUE + (sub_alpha,))
                        sy += 50
                frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")

            # Firma, presente en todo el video
            fdraw = ImageDraw.Draw(frame)
            f_handle = text_font(30, "Regular")
            hbbox = fdraw.textbbox((0, 0), handle_text, font=f_handle)
            hw = hbbox[2] - hbbox[0]
            fdraw.text(((W - hw) / 2, H - 90), handle_text, font=f_handle, fill=WHITE)

            frame.save(os.path.join(tmp_dir, f"frame_{i:05d}.png"))

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

    return output_path


if __name__ == "__main__":
    render_reel(
        hook_text="¿SABÍAS QUE YA ESTÁS PAGANDO POR TU OBRA SOCIAL, LA USES O NO?",
        highlight_word="NO?",
        dev_lines=[
            "Ese % de tu sueldo",
            "es tuyo.",
            "Vos decidís a dónde va.",
        ],
        cta_text="Escribime APORTES",
        subcta_text="y te cuento cómo funciona, sin vueltas.",
        handle_text="@simoonhaddad · Asesor Federada Salud",
        output_path=os.path.join(REPO_ROOT, "assets", "generated", "reel-aportes-dependencia.mp4"),
    )
    print("listo")
