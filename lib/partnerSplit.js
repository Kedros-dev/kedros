// Factory-default partners and split table, used only to bootstrap an empty database on
// first run. After that, everything lives in the Partner/SplitRule tables and is edited
// from the admin panel.
const DEFAULT_PARTNER_NAMES = ["Jason", "Jad", "Christiane"];

export async function ensurePartnersSeeded(prisma) {
  const existing = await prisma.partner.count();
  if (existing > 0) return;

  const [jason, jad, christiane] = await Promise.all(
    DEFAULT_PARTNER_NAMES.map((name, sortOrder) => prisma.partner.create({ data: { name, sortOrder } }))
  );

  await prisma.splitRule.createMany({
    data: [
      { broughtByPartnerId: jason.id, supervisingRequired: true, splits: { [jason.id]: 70, [jad.id]: 15, [christiane.id]: 15 } },
      { broughtByPartnerId: jad.id, supervisingRequired: true, splits: { [jason.id]: 40, [jad.id]: 40, [christiane.id]: 20 } },
      { broughtByPartnerId: christiane.id, supervisingRequired: true, splits: { [jason.id]: 40, [jad.id]: 20, [christiane.id]: 40 } },
      { broughtByPartnerId: null, supervisingRequired: true, splits: { [jason.id]: 50, [jad.id]: 25, [christiane.id]: 25 } },
      { broughtByPartnerId: jason.id, supervisingRequired: false, splits: { [jason.id]: 70, [jad.id]: 30 } },
      { broughtByPartnerId: jad.id, supervisingRequired: false, splits: { [jason.id]: 60, [jad.id]: 40 } },
      { broughtByPartnerId: null, supervisingRequired: false, splits: { [jason.id]: 65, [jad.id]: 35 } }
    ]
  });
}

export function findSplitRule(rules, broughtByPartnerId, supervisingRequired) {
  const key = broughtByPartnerId || null;
  return rules.find((rule) => (rule.broughtByPartnerId || null) === key && rule.supervisingRequired === supervisingRequired) || null;
}

// A client's own splitOverride (if set) always wins over the default SplitRule.
export function resolveSplitPercentages(client, rules) {
  if (client.splitOverride) return client.splitOverride;
  const rule = findSplitRule(rules, client.broughtByPartnerId, client.supervisingRequired);
  return rule ? rule.splits : null;
}

export function computeSplitCents(amountCents, splitPercentages) {
  if (!splitPercentages) return null;
  const split = {};
  for (const [partnerId, percentage] of Object.entries(splitPercentages)) {
    split[partnerId] = Math.round((amountCents * Number(percentage)) / 100);
  }
  return split;
}

export function sumPercentages(splitPercentages) {
  return Object.values(splitPercentages || {}).reduce((sum, percentage) => sum + Number(percentage), 0);
}

// Accepts a raw { [partnerId]: percentage } object from a request body, or null/undefined
// to clear the override. Drops any non-numeric or non-positive entries.
export function sanitizeSplitOverride(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cleaned = {};
  for (const [partnerId, percentage] of Object.entries(raw)) {
    const value = Number(percentage);
    if (Number.isFinite(value) && value > 0) cleaned[partnerId] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}
