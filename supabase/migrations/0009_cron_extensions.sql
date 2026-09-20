-- Bloque 5: automatización 24/7 real, sin depender de que la computadora
-- de Simón esté prendida. pg_cron + pg_net están disponibles en el plan
-- actual (verificado: son extensiones de Postgres, no una feature paga
-- aparte) y permiten llamar a nuestras Edge Functions por HTTP desde un
-- cron corriendo dentro de la base de datos, en la nube, 24/7.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
