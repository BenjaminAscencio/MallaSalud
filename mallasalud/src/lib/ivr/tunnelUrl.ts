/**
 * Resolución dinámica de la URL pública HTTPS del túnel Cloudflare o dominio en la nube.
 * Evita que URLs temporales expiradas de `.env` rompan las llamadas de Twilio.
 */

const CACHE_TTL_MS = 10_000;
let cachedTunnelUrl: string | null = null;
let cachedAt = 0;

function sanitizeBaseUrl(url?: string | null): string {
  return String(url || "").trim().replace(/\/+$/, "");
}

function isLocalUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function isPermanentHttps(url: string): boolean {
  if (!url.startsWith("https://")) return false;
  if (isLocalUrl(url)) return false;
  if (url.includes(".trycloudflare.com")) return false;
  return true;
}

/**
 * Consulta la API interna de metrics/quicktunnel del contenedor `tunnel` en Docker.
 * Retorna `https://<hostname>` si hay un túnel Cloudflare activo, o `null` si no aplica.
 */
export async function detectLiveCloudflareTunnelUrl(): Promise<string | null> {
  const now = Date.now();
  if (cachedTunnelUrl && now - cachedAt < CACHE_TTL_MS) {
    return cachedTunnelUrl;
  }

  try {
    const res = await fetch("http://tunnel:20241/quicktunnel", {
      cache: "no-store",
      signal: AbortSignal.timeout(1200),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { hostname?: string } | null;
    const hostname = typeof data?.hostname === "string" ? data.hostname.trim() : "";
    if (!hostname || hostname.includes("localhost")) return null;

    const url = `https://${hostname.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}`;
    cachedTunnelUrl = url;
    cachedAt = now;
    return url;
  } catch {
    return null;
  }
}

/**
 * Resuelve la URL base pública HTTPS vigente para los webhooks de Twilio Voice.
 * Precedencia:
 * 1. URL HTTPS permanente explícita (no localhost ni trycloudflare).
 * 2. PUBLIC_WEBHOOK_BASE_URL permanente (ej. dominio en Railway/nube).
 * 3. Túnel Cloudflare activo detectado desde `http://tunnel:20241/quicktunnel`.
 * 4. Respaldo con URL explícita o de entorno.
 */
export async function resolvePublicWebhookBaseUrl(explicitUrl?: string): Promise<string> {
  const cleanExplicit = sanitizeBaseUrl(explicitUrl);
  const cleanEnv = sanitizeBaseUrl(process.env.PUBLIC_WEBHOOK_BASE_URL);

  if (isPermanentHttps(cleanExplicit)) {
    return cleanExplicit;
  }
  if (isPermanentHttps(cleanEnv)) {
    return cleanEnv;
  }

  const liveTunnel = await detectLiveCloudflareTunnelUrl();
  if (liveTunnel) {
    return liveTunnel;
  }

  if (cleanExplicit && !isLocalUrl(cleanExplicit)) {
    return cleanExplicit;
  }
  if (cleanEnv && !isLocalUrl(cleanEnv)) {
    return cleanEnv;
  }
  return cleanExplicit || cleanEnv;
}
