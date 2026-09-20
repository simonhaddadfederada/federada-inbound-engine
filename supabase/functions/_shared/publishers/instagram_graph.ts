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

export async function createVideoContainer(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
  mediaType: "REELS" | "VIDEO" = "REELS",
  fetchImpl: typeof fetch = fetch,
): Promise<GraphResult> {
  return graphPost(
    `/${igUserId}/media`,
    { video_url: videoUrl, media_type: mediaType, caption, access_token: accessToken },
    fetchImpl,
  );
}

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

export type ContainerStatusResult =
  | { ok: true; status: ContainerStatus }
  | { ok: false; error: string };

export async function getContainerStatus(
  containerId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ContainerStatusResult> {
  try {
    const url = `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetchImpl(url);
    const json = await res.json();
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, status: json.status_code };
  } catch (err) {
    return { ok: false, error: `Error de red: ${String(err)}` };
  }
}

export type WaitResult = { ok: true } | { ok: false; error: string };

// A diferencia de una imagen (lista casi al instante), un video/reel se
// procesa de forma asíncrona en los servidores de Meta — hay que esperar
// a que el contenedor pase a FINISHED antes de poder publicarlo, o Meta
// devuelve un error. `delayImpl`/`maxAttempts` son inyectables para no
// esperar de verdad en los tests.
export async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
  maxAttempts = 20,
  intervalMs = 5000,
  delayImpl: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<WaitResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await getContainerStatus(containerId, accessToken, fetchImpl);
    if (!result.ok) return { ok: false, error: result.error };
    if (result.status === "FINISHED") return { ok: true };
    if (result.status === "ERROR" || result.status === "EXPIRED") {
      return { ok: false, error: `Meta no pudo procesar el video (status_code=${result.status})` };
    }
    if (attempt < maxAttempts) await delayImpl(intervalMs);
  }
  return {
    ok: false,
    error: "Timeout esperando a que Meta termine de procesar el video (status_code nunca llegó a FINISHED)",
  };
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

// El HTTP 400 de la primera publicación real (20/09/2026) fue transitorio:
// un reintento manual segundos después funcionó sin cambiar nada. Esta
// función reintenta publishContainer con backoff antes de darlo por
// fallado de verdad. `delayImpl` es inyectable para no esperar de verdad
// en los tests.
export async function publishContainerWithRetry(
  igUserId: string,
  accessToken: string,
  containerId: string,
  fetchImpl: typeof fetch = fetch,
  maxAttempts = 3,
  delayImpl: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<GraphResult> {
  let lastError = "sin intentos";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await publishContainer(igUserId, accessToken, containerId, fetchImpl);
    if (result.ok) return result;
    lastError = result.error;
    if (attempt < maxAttempts) {
      await delayImpl(attempt * 1000); // backoff simple: 1s, 2s, ...
    }
  }
  return { ok: false, error: lastError };
}

export interface MediaDetails {
  permalink: string;
  timestamp: string;
}

export type MediaDetailsResult =
  | { ok: true; details: MediaDetails }
  | { ok: false; error: string };

export async function getMediaDetails(
  mediaId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MediaDetailsResult> {
  try {
    const url = `${GRAPH_BASE}/${mediaId}?fields=permalink,timestamp&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetchImpl(url);
    const json = await res.json();
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, details: { permalink: json.permalink, timestamp: json.timestamp } };
  } catch (err) {
    return { ok: false, error: `Error de red: ${String(err)}` };
  }
}

export interface MediaInsights {
  reach?: number;
  saved?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export type InsightsResult =
  | { ok: true; insights: MediaInsights }
  | { ok: false; error: string };

// impressions no se pide: Meta no la soporta para media_product_type FEED
// (confirmado con un error real el 20/09/2026) — no se inventa ese dato.
export async function getMediaInsights(
  mediaId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InsightsResult> {
  try {
    const url =
      `${GRAPH_BASE}/${mediaId}/insights?metric=reach,saved,likes,comments,shares&access_token=${
        encodeURIComponent(accessToken)
      }`;
    const res = await fetchImpl(url);
    const json = await res.json();
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    const insights: MediaInsights = {};
    for (const metric of json.data ?? []) {
      const value = metric.values?.[0]?.value;
      if (typeof value === "number" && metric.name in { reach: 1, saved: 1, likes: 1, comments: 1, shares: 1 }) {
        (insights as Record<string, number>)[metric.name] = value;
      }
    }
    return { ok: true, insights };
  } catch (err) {
    return { ok: false, error: `Error de red: ${String(err)}` };
  }
}

export type RefreshResult =
  | { ok: true; accessToken: string; expiresInSeconds: number }
  | { ok: false; error: string };

// El token que emite el panel de Meta para "Instagram API with Instagram
// Login" ya es de larga duración (60 días) — este es el endpoint correcto
// para renovarlo (grant_type=ig_refresh_token), NO el de intercambio
// (ig_exchange_token, que es para tokens cortos y devuelve "Session key
// invalid" si se lo usa sobre uno que ya es largo — así se detectó el bug).
export async function refreshLongLivedToken(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshResult> {
  try {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${
      encodeURIComponent(accessToken)
    }`;
    const res = await fetchImpl(url);
    const json = await res.json();
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, accessToken: json.access_token, expiresInSeconds: json.expires_in };
  } catch (err) {
    return { ok: false, error: `Error de red: ${String(err)}` };
  }
}
