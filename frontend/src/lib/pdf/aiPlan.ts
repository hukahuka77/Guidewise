import type { Sql } from "@/lib/server/db";
import { consumeAiQuota, refundAiQuota } from "@/lib/server/usage";
import { composeGuidePlan, composerHash, composerInput, PLAN_VERSION, type GuidePlan } from "./guide/compose";
import type { GuideModel } from "./guide/model";

export type AiPlanStatus = "cached" | "generated" | "fallback";

export interface AiPlanDeps {
  compose: (model: GuideModel) => Promise<GuidePlan | null>;
}

const defaultDeps: AiPlanDeps = { compose: (model) => composeGuidePlan(model) };

/**
 * The composed plan for this guide: reused from the cache while nothing the model sees has changed, otherwise
 * generated (one AI allowance, refunded if nothing usable comes back). `null` means "use the standard design".
 * The cache is best effort: if the table is unavailable the guide is simply composed again.
 */
export async function resolveAiPlan(
  sql: Sql,
  userId: string,
  guidebookId: string,
  model: GuideModel,
  options: { refresh?: boolean } = {},
  deps: AiPlanDeps = defaultDeps,
): Promise<{ plan: GuidePlan | null; status: AiPlanStatus }> {
  const hash = composerHash(composerInput(model));

  if (!options.refresh) {
    try {
      const rows = await sql`
        select plan from public.guidebook_pdf_plan where guidebook_id = ${guidebookId} and content_hash = ${hash} and version = ${PLAN_VERSION}`;
      if (rows.length) return { plan: rows[0].plan as GuidePlan, status: "cached" };
    } catch (error) {
      console.warn("pdf plan cache read failed", error);
    }
  }

  await consumeAiQuota(sql, userId); // 403 with an upgrade hint when the monthly allowance is used up
  const plan = await deps.compose(model);
  if (!plan) {
    await refundAiQuota(sql, userId);
    return { plan: null, status: "fallback" };
  }
  try {
    await sql`
      insert into public.guidebook_pdf_plan (guidebook_id, content_hash, version, plan)
      values (${guidebookId}, ${hash}, ${PLAN_VERSION}, ${sql.json(plan as unknown as Parameters<typeof sql.json>[0])})
      on conflict (guidebook_id) do update set content_hash = excluded.content_hash, version = excluded.version, plan = excluded.plan, created_at = now()`;
  } catch (error) {
    console.warn("pdf plan cache write failed", error);
  }
  return { plan, status: "generated" };
}
