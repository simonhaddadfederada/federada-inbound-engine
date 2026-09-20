// Lee/escribe el token de Instagram en la tabla protegida `platform_tokens`
// (RLS bloqueado para anon/authenticated — ver 0011_platform_tokens.sql).
// El valor del token NUNCA se devuelve en respuestas de error ni se loguea
// completo; estas funciones son el único lugar que lo toca.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface InstagramTokenRow {
  access_token: string;
  expires_at: string;
  last_refreshed_at: string;
  refresh_count: number;
}

export async function getInstagramToken(supabase: SupabaseClient): Promise<InstagramTokenRow | null> {
  const { data } = await supabase
    .from("platform_tokens")
    .select("access_token, expires_at, last_refreshed_at, refresh_count")
    .eq("platform", "instagram")
    .maybeSingle();
  return data ?? null;
}

export async function saveInstagramToken(
  supabase: SupabaseClient,
  accessToken: string,
  expiresAt: string,
  refreshCount: number,
): Promise<void> {
  await supabase.from("platform_tokens").upsert({
    platform: "instagram",
    access_token: accessToken,
    expires_at: expiresAt,
    last_refreshed_at: new Date().toISOString(),
    refresh_count: refreshCount,
    last_refresh_error: null,
  });
}

export async function recordInstagramRefreshError(supabase: SupabaseClient, error: string): Promise<void> {
  await supabase.from("platform_tokens").update({ last_refresh_error: error }).eq("platform", "instagram");
}
