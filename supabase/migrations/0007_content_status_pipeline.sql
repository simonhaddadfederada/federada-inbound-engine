-- Pipeline completo de publicación (Bloque 4 / Motor de marketing V1).
-- 'aprobado' pasa a llamarse 'listo' (mismo significado: revisado y
-- aprobado por Simón, listo para programar) y se agregan los estados
-- que faltan para reflejar todo el ciclo:
-- borrador -> listo -> programado -> publicado -> medido -> ganador/normal/perdedor
alter type content_status rename value 'aprobado' to 'listo';
alter type content_status add value if not exists 'programado';
alter type content_status add value if not exists 'medido';
alter type content_status add value if not exists 'ganador';
alter type content_status add value if not exists 'normal';
alter type content_status add value if not exists 'perdedor';
