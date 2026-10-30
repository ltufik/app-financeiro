// Pricing simulator for the product console: one month of revenue and costs, in R$.
// Pure function, tested in tests/lib.test.mjs.
export function pricingCalc(p) {
  const payers = p.families * p.payingPct / 100, yearly = payers * p.yearlyShare / 100, monthly = payers - yearly;
  const revenue = monthly * p.priceMonthly + yearly * p.priceYearly / 12, fees = revenue * p.feePct / 100;
  const ai = p.families * p.activePct / 100 * p.aiPerFamily, infra = (p.supabaseUsd + p.vercelUsd) * p.fx;
  const result = revenue - fees - ai - infra;
  const perFamily = (revenue - fees - ai) / (p.families || 1);
  return { payers, revenue, fees, ai, infra, result, margin: revenue ? result / revenue : 0, breakEven: perFamily > 0 ? Math.ceil(infra / perFamily) : null };
}
