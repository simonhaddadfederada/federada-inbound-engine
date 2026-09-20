// Llamadas de bajo nivel a la Instagram Graph API (Instagram API with
// Instagram Login), separadas para poder testear la lógica de más arriba
// con un fetch inyectado, sin pegarle a la red real.
//
// Confirmado con una llamada REAL el 20/09/2026: crear un contenedor de
// imagen y publicarlo funciona con Standard Access (token de la propia
// cuenta), sin necesitar Advanced Access/App Review — ver
// docs/capacidades-meta.md. Lo que SÍ falta hoy es un token de LARGA
// duración: el intercambio a 60 días falla ("Session key invalid"),
// mismo error ya visto antes — pendiente de resolver.

const GRAPH_BASE = "https://graph.instagram.com/v21.0";

export type GraphResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function graphPost(
  path: string,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<GraphResult> {
  const body = new URLSearchParams(params);
  try {
    const res = await fetchImpl(`${GRAPH_BASE}${path}`, { method: "POST", body });
    const json = await res.json();
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: `Error de red: ${String(err)}` };
  }
}

export async function createImageContainer(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GraphResult> {
  return graphPost(`/${igUserId}/media`, { image_url: imageUrl, caption, access_token: accessToken }, fetchImpl);
}

export async function createStoryContainer(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GraphResult> {
  return graphPost(
    `/${igUserId}/media`,
    { image_url: imageUrl, media_type: "STORIES", access_token: accessToken },
    fetchImpl,
  );
}

export async function publishContainer(
  igUserId: string,
  accessToken: string,
  containerId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GraphResult> {
  return graphPost(
    `/${igUserId}/media_publish`,
    { creation_id: containerId, access_token: accessToken },
    fetchImpl,
  );
}
