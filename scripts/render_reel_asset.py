"""Reel Engine V3.1 — como V3, pero la duración de cada beat la marca la
VOZ REAL (ElevenLabs, voz "Melanie" — es-AR), no un número inventado.

Cada beat trae su propio texto hablado. Se sintetiza el guion completo en
UNA sola llamada (prosodia natural, sin cortes raros entre frases) al
endpoint with-timestamps de ElevenLabs, que devuelve el tiempo exacto de
cada CARÁCTER — se agrupan en palabras (separando por espacios) para
saber cuándo se dice cada una, y de ahí sale cuánto dura en pantalla
cada beat. Nada de sincronización adivinada.

Reglas del motor (heredadas de V3, ver docs/reel-engine-v3.md):
- beats de 1-3s con composición distinta cada uno;
- safe areas reales (no tapar con UI de Reels);
- texto en pantalla = solo el concepto corto de cada beat, nunca la
  transcripción completa (evita subtítulo-pared-de-texto).

Requiere: Pillow, imageio-ffmpeg (instalables por pip). Necesita
ELEVENLABS_API_KEY (plan Starter — el free no permite usar voces de la
biblioteca vía API, verificado con una llamada real).
"""

import os
import re
import json
import base64
import math
import shutil
import subprocess
import tempfile
import urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

MELANIE_VOICE_ID = "bN1bDXgDIGX5lw0rtY2B"  # ElevenLabs, "Melanie - Ecommerce Voice", es-AR

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(REPO_ROOT, "assets", "fonts")

W, H = 1080, 1920
FPS = 24
NAVY = (0, 20, 137)
NAVY_DEEP = (0, 12, 92)
MAGENTA = (240, 78, 152)
WHITE = (255, 255, 255)
LIGHT_BLUE = (196, 205, 240)

SAFE_TOP = 260
SAFE_BOTTOM = 340
SAFE_RIGHT = 150
SAFE_LEFT = 70
SAFE_W = W - SAFE_LEFT - SAFE_RIGHT

BG_W, BG_H = 1350, 2400

PUNCT_ONLY = re.compile(r'^[¿?¡!.,;:"\'…-]+$')


def _load_env():
    env = {}
    with open(os.path.join(REPO_ROOT, ".env")) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v
    return env


def synthesize_with_timing(full_text: str, voice_id: str, out_audio_path: str):
    """Sintetiza full_text con ElevenLabs (with-timestamps) y devuelve la
    lista de palabras reales con su offset/duración exactos, reconstruidas
    a partir del timing por caracter que da la API."""
    env = _load_env()
    key = env["ELEVENLABS_API_KEY"]

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
    body = json.dumps({"text": full_text, "model_id": "eleven_multilingual_v2"}).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"xi-api-key": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"ElevenLabs no pudo sintetizar ({e.code}): {e.read().decode()}")

    audio_bytes = base64.b64decode(data["audio_base64"])
    with open(out_audio_path, "wb") as f:
        f.write(audio_bytes)

    align = data["alignment"]
    chars = align["characters"]
    starts = align["character_start_times_seconds"]
    ends = align["character_end_times_seconds"]

    words = []
    current, word_start, word_end = "", None, None
    for ch, s, e in zip(chars, starts, ends):
        if ch.strip() == "":
            if current:
                words.append({"text": current, "start_ms": word_start * 1000, "duration_ms": (word_end - word_start) * 1000})
                current, word_start, word_end = "", None, None
            continue
        if word_start is None:
            word_start = s
        current += ch
        word_end = e
    if current:
        words.append({"text": current, "start_ms": word_start * 1000, "duration_ms": (word_end - word_start) * 1000})

    real_words = [w for w in words if not PUNCT_ONLY.fullmatch(w["text"])]
    return real_words


def assign_beat_timing(beats, word_timings, tail_buffer_ms=500):
    """Consume word_timings secuencialmente segun la cantidad de palabras
    de cada beat['text']/beat['spoken'], y fija start_ms/duration_ms reales."""
    cursor = 0
    for i, beat in enumerate(beats):
        spoken = beat.get("spoken", beat.get("text", ""))
        n_words = len(spoken.split())
        words_for_beat = word_timings[cursor:cursor + n_words]
        if not words_for_beat:
            raise ValueError(f"No hay timing de audio para el beat {i} ({spoken!r})")
        start_ms = words_for_beat[0]["start_ms"]
        cursor += n_words
        if cursor < len(word_timings):
            end_ms = word_timings[cursor]["start_ms"]
        else:
            last = words_for_beat[-1]
            end_ms = last["start_ms"] + last["duration_ms"] + tail_buffer_ms
        beat["start_ms"] = start_ms
        beat["duration"] = (end_ms - start_ms) / 1000.0
    return beats


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


def render_reel(beats, cta_text, subcta_text, handle_text, output_path, voice_id=MELANIE_VOICE_ID):
    # 1) Sintetizar el guion completo y repartir timing real por beat.
    full_script = ". ".join(b.get("spoken", b.get("text", "")) for b in beats)
    tmp_dir = tempfile.mkdtemp(prefix="reelv31_")
    audio_path = os.path.join(tmp_dir, "voice.mp3")
    word_timings = synthesize_with_timing(full_script, voice_id, audio_path)
    beats = assign_beat_timing(beats, word_timings)

    total_duration = sum(b["duration"] for b in beats)
    n_frames = int(total_duration * FPS)

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
                line_h = int(f.size * 1.14)
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
        silent_path = os.path.join(tmp_dir, "silent.mp4")
        cmd_video = [
            ffmpeg_bin, "-y",
            "-framerate", str(FPS),
            "-i", os.path.join(tmp_dir, "frame_%05d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            silent_path,
        ]
        r1 = subprocess.run(cmd_video, capture_output=True, text=True)
        if r1.returncode != 0:
            raise RuntimeError(f"ffmpeg (video) fallo: {r1.stderr[-2000:]}")

        cmd_mux = [
            ffmpeg_bin, "-y",
            "-i", silent_path,
            "-i", audio_path,
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
            "-map", "0:v:0", "-map", "1:a:0",
            "-shortest", "-movflags", "+faststart",
            output_path,
        ]
        r2 = subprocess.run(cmd_mux, capture_output=True, text=True)
        if r2.returncode != 0:
            raise RuntimeError(f"ffmpeg (mux audio) fallo: {r2.stderr[-2000:]}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return output_path, total_duration


if __name__ == "__main__":
    beats = [
        {"type": "question", "text": "¿SOS MONOTRIBUTISTA Y NO SABÉS EN QUÉ CATEGORÍA ESTÁS?",
         "spoken": "¿Sos monotributista y no sabés en qué categoría estás?",
         "highlight": "CATEGORÍA"},
        {"type": "stat", "text": "UNA PARTE DE TU CUOTA", "sub": "va directo a tu cobertura médica.",
         "spoken": "Una parte de tu cuota va directo a tu cobertura médica."},
        {"type": "line", "text": "Y la mayoría no sabe", "sub": "cuánto es, ni qué puede hacer con eso.",
         "spoken": "Y la mayoría no sabe cuánto es, ni qué puede hacer con eso."},
        {"type": "hook_punch", "text": "PODÉS SABERLO EN DOS MINUTOS.", "highlight": "MINUTOS.",
         "spoken": "Podés saberlo en dos minutos."},
        {"type": "cta", "spoken": "Escribime PLAN y vemos qué te conviene según tu categoría."},
    ]
    out, dur = render_reel(
        beats,
        cta_text="Escribime PLAN",
        subcta_text="y vemos qué te conviene según tu categoría.",
        handle_text="@simoonhaddad · Asesor Federada Salud",
        output_path=os.path.join(REPO_ROOT, "assets", "generated", "reel-monotributo-cobertura-voz.mp4"),
    )
    print("listo", out, f"{dur:.1f}s")
