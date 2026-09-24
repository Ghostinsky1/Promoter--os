// PROMOTER OS — AI credits, shared by every function that calls a language model.
//
// Jose's numbers (Sep 24 2026): trial 20 one-time · starter 100 · pro 400 ·
// agency_scale 1,500 per billing month. Packs of 100 ($9) and 500 ($35) never
// expire and are spent after the monthly ones.
//
// Weights: chat text 1 · chat with files 2 · document scan 3.
// Deal Score and Insights are plain arithmetic on the promoter's own numbers,
// not a model, and cost NOTHING. They must never charge a credit.

// deno-lint-ignore no-explicit-any
type Any = any;

export const CREDIT_COST = {
  chat_text: 1,
  chat_with_files: 2,
  doc_scan: 3,
} as const;

export interface CreditStatus {
  monthly_allowance: number;
  monthly_left: number;
  topup: number;
  total_left: number;
  period_start: string;
}

export async function creditStatus(supabase: Any, orgId: string): Promise<CreditStatus | null> {
  const { data, error } = await supabase.rpc('ai_credit_status', { org: orgId });
  if (error) { console.error('ai_credit_status', error); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

/** True when the org can afford `n` credits right now. */
export async function canAfford(supabase: Any, orgId: string, n: number): Promise<{ ok: boolean; status: CreditStatus | null }> {
  const status = await creditStatus(supabase, orgId);
  return { ok: !!status && status.total_left >= n, status };
}

/** Take the credits after a successful call. Returns what is left, or null on failure. */
export async function spendCredits(
  supabase: Any,
  orgId: string,
  n: number,
  feature: string,
  userId?: string | null,
  offerId?: string | null,
  costUsd?: number | null,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('spend_ai_credits', {
    org: orgId, n, feature, p_user: userId ?? null, p_offer: offerId ?? null, p_cost: costUsd ?? null,
  });
  if (error) { console.error('spend_ai_credits', error); return null; }
  return typeof data === 'number' ? data : null;
}

/** The body every function returns when the org is out of credits. */
export function outOfCredits(status: CreditStatus | null, needed: number) {
  return {
    error: status && status.total_left > 0
      ? `This needs ${needed} credits and you have ${status.total_left} left.`
      : 'You are out of AI credits for this month.',
    credits: true,
    credits_left: status?.total_left ?? 0,
    credits_needed: needed,
  };
}
