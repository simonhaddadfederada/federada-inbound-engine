// Parseo del webhook de Meta Lead Ads (campo "leadgen" de una Página) y
// mapeo de las respuestas del formulario a nuestros campos mínimos.
// Reglas fijas, sin IA — igual que el resto del sistema de intake.

export interface LeadgenChangeValue {
  leadgen_id: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  adgroup_id?: string; // nombre legado del mismo dato que ad_id en algunos payloads
  campaign_id?: string;
  created_time?: number;
}

export interface LeadgenWebhookPayload {
  object: string;
  entry: { id: string; time: number; changes: { field: string; value: LeadgenChangeValue }[] }[];
}

export function extractLeadgenEvents(payload: LeadgenWebhookPayload): LeadgenChangeValue[] {
  const events: LeadgenChangeValue[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "leadgen" && change.value?.leadgen_id) {
        events.push(change.value);
      }
    }
  }
  return events;
}

export interface FieldDatum {
  name: string;
  values: string[];
}

export interface LeadgenDetails {
  field_data: FieldDatum[];
}

export interface MappedLeadgenFields {
  phone: string | null;
  ageRange: string | null;
  hasCoverage: boolean | null;
}

const VALID_AGE_RANGES = ["18_25", "26_35", "36_45", "46_mas"];

// Nombres de pregunta esperados en el formulario de Meta (custom questions
// que hay que configurar así al crear el formulario en Ads Manager, cuando
// se decida pautar — ver docs/meta-lead-ads.md).
const FIELD_NAMES = {
  phone: ["phone_number", "telefono", "whatsapp"],
  ageRange: ["rango_edad", "edad"],
  hasCoverage: ["tiene_cobertura", "cobertura_actual"],
};

function firstValue(byName: Map<string, string>, candidates: string[]): string | null {
  for (const name of candidates) {
    const v = byName.get(name);
    if (v) return v;
  }
  return null;
}

function parseYesNo(raw: string | null): boolean | null {
  if (raw === null) return null;
  const normalized = raw.trim().toLowerCase();
  if (["si", "sí", "yes", "true"].includes(normalized)) return true;
  if (["no", "false"].includes(normalized)) return false;
  return null;
}

export function mapLeadgenFields(details: LeadgenDetails): MappedLeadgenFields {
  const byName = new Map((details.field_data ?? []).map((f) => [f.name, f.values?.[0] ?? ""]));

  const phone = firstValue(byName, FIELD_NAMES.phone);
  const ageRaw = firstValue(byName, FIELD_NAMES.ageRange);
  const coverageRaw = firstValue(byName, FIELD_NAMES.hasCoverage);

  return {
    phone: phone || null,
    ageRange: ageRaw && VALID_AGE_RANGES.includes(ageRaw) ? ageRaw : null,
    hasCoverage: parseYesNo(coverageRaw),
  };
}
