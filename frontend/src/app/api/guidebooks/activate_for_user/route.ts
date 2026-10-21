import { proxyToBackend } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

/**
 * Not migrated: the Flask route calls a helper that does not exist, so it currently always errors.
 * This explicit route exists so POST /api/guidebooks/activate_for_user is not captured by the
 * dynamic /api/guidebooks/[id] route (which would answer 405) and still reaches Flask unchanged.
 */
export function POST(request: Request) {
  return proxyToBackend(request);
}
