-- Soporta la landing de fricción mínima: agrega los dos únicos campos de
-- "perfil" que se piden con un tap (rango etario, cobertura actual). No se
-- borra ninguna columna existente — otros canales (Instagram, carga manual)
-- pueden seguir usando employment_type/coverage_for/intent_timeframe/locality
-- si en algún momento avanzan la conversación lo suficiente.

alter table leads add column age_range text
  check (age_range in ('18_25', '26_35', '36_45', '46_mas') or age_range is null);

alter table leads add column has_coverage boolean;
