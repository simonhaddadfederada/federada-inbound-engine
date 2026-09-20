// Tipos usados por canales que sí alcanzan a recolectar más detalle
// (por ejemplo, una conversación de Instagram ya avanzada, o carga manual
// del asesor). La landing de fricción mínima NO los pide.
export type EmploymentType = "dependencia" | "monotributo" | "particular";
export type CoverageFor = "individual" | "grupo_familiar";
export type IntentTimeframe =
  | "inmediato"
  | "1_3_meses"
  | "mas_de_3_meses"
  | "sin_definir";

// Rango etario: la única pregunta de "perfil" que pedimos en la landing,
// porque se contesta con un solo tap y no exige escribir nada.
export type AgeRange = "18_25" | "26_35" | "36_45" | "46_mas";

export type SourceChannel =
  | "landing"
  | "instagram"
  | "facebook"
  | "whatsapp"
  | "meta_ads"
  | "google"
  | "email"
  | "referido"
  | "otro";

export type ScoreBand = "frio" | "tibio" | "caliente" | "contactar_ahora";

// Payload del formulario de landing de fricción mínima: 2 taps + 1 teléfono.
// El teléfono es obligatorio (es el único canal de retorno posible desde la
// landing). No se piden nombre, localidad, situación laboral ni aporte acá
// — eso se conversa después, personalmente.
export interface LandingFormPayload {
  ageRange?: AgeRange;
  hasCoverage?: boolean;
  phone: string;
  consent: boolean;
  campaign?: string;
  postRef?: string;
  threadId?: string; // opcional: id de sesión generado por el navegador
}

export interface LeadRow {
  id: string;
  source_channel: SourceChannel;
  campaign: string | null;
  post_ref: string | null;
  external_thread_id: string | null;
  name: string | null;
  locality: string | null;
  employment_type: EmploymentType | null;
  contribution_approx: string | null;
  coverage_for: CoverageFor | null;
  intent_timeframe: IntentTimeframe | null;
  age_range: AgeRange | null;
  has_coverage: boolean | null;
  phone: string | null;
  explicit_info_request: boolean;
  answers_completed: number;
  consent: boolean;
  consent_at: string | null;
  score: number;
  score_band: ScoreBand;
}
