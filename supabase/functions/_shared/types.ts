export type EmploymentType = "dependencia" | "monotributo" | "particular";
export type CoverageFor = "individual" | "grupo_familiar";
export type IntentTimeframe =
  | "inmediato"
  | "1_3_meses"
  | "mas_de_3_meses"
  | "sin_definir";

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

// Payload que manda el formulario de la landing page.
export interface LandingFormPayload {
  name?: string;
  locality?: string;
  employmentType?: EmploymentType;
  contributionApprox?: string;
  coverageFor?: CoverageFor;
  intentTimeframe?: IntentTimeframe;
  phone?: string;
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
  phone: string | null;
  explicit_info_request: boolean;
  answers_completed: number;
  consent: boolean;
  consent_at: string | null;
  score: number;
  score_band: ScoreBand;
}
