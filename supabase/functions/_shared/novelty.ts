// Reglas fijas (sin IA) para evitar que el generador repita ganchos, temas
// o CTAs seguidos y que la cuenta empiece a sonar automatizada. Se corren
// ANTES de guardar cualquier pieza nueva, generada por IA o a mano.

export interface RecentPieceForNovelty {
  theme: string | null;
  hook: string;
  cta: string;
}

export interface NoveltyCandidate {
  theme: string | null;
  hook: string;
  cta: string;
}

export interface NoveltyCheckInput {
  candidate: NoveltyCandidate;
  // Piezas recientes, ordenadas de más nueva a más vieja.
  recent: RecentPieceForNovelty[];
  lookbackN?: number; // default 5
  maxSameThemeInLookback?: number; // default 2
  maxSameCtaInLookback?: number; // default 3
}

export interface NoveltyResult {
  ok: boolean;
  reason?: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function checkNovelty(input: NoveltyCheckInput): NoveltyResult {
  const lookbackN = input.lookbackN ?? 5;
  const maxSameThemeInLookback = input.maxSameThemeInLookback ?? 2;
  const maxSameCtaInLookback = input.maxSameCtaInLookback ?? 3;
  const window = input.recent.slice(0, lookbackN);

  const candidateHook = normalize(input.candidate.hook);
  if (window.some((p) => normalize(p.hook) === candidateHook)) {
    return { ok: false, reason: "El hook es idéntico a uno usado recientemente" };
  }

  if (input.candidate.theme) {
    const sameTheme = window.filter((p) => p.theme === input.candidate.theme).length;
    if (sameTheme >= maxSameThemeInLookback) {
      return {
        ok: false,
        reason:
          `El tema "${input.candidate.theme}" ya se usó ${sameTheme} veces en las últimas ${window.length} piezas`,
      };
    }
  }

  const candidateCta = normalize(input.candidate.cta);
  const sameCta = window.filter((p) => normalize(p.cta) === candidateCta).length;
  if (sameCta >= maxSameCtaInLookback) {
    return {
      ok: false,
      reason: `El CTA "${input.candidate.cta}" se repitió demasiadas veces seguidas`,
    };
  }

  return { ok: true };
}
