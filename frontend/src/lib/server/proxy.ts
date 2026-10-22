import { BACKEND_URL } from "./env";

const FORWARDED_REQUEST_HEADERS = ["authorization", "if-none-match", "accept", "accept-language", "content-type"];
const LOOP_HEADER = "x-guidewise-proxied";

/** Set DISABLE_BACKEND_FALLBACK=1 (e.g. on Preview) to surface what the Next.js code does instead of hiding it behind Flask. */
export const backendFallbackDisabled = () => ["1", "true", "yes"].includes((process.env.DISABLE_BACKEND_FALLBACK ?? "").toLowerCase());

/** Forward a request to the Flask backend and stream its response back unchanged. */
export async function proxyToBackend(request: Request): Promise<Response> {
  if (request.headers.get(LOOP_HEADER)) {
    return new Response("Backend proxy loop detected", { status: 508 });
  }
  if (backendFallbackDisabled()) {
    return Response.json(
      { error: "Not handled by Next.js here (missing configuration?) and the Flask fallback is disabled", fallback: "disabled" },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const headers = new Headers({ [LOOP_HEADER]: "1" });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(`${BACKEND_URL}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });
  const responseHeaders = new Headers(upstream.headers);
  for (const name of ["content-encoding", "content-length", "transfer-encoding", "connection"]) {
    responseHeaders.delete(name);
  }
  responseHeaders.set("x-guidewise-served-by", "flask");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
