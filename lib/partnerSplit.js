export const PARTNERS = ["Jason", "Jad", "Christiane"];

export const BROUGHT_BY_OPTIONS = [
  { value: "JASON", label: "Jason" },
  { value: "JAD", label: "Jad" },
  { value: "CHRISTIANE", label: "Christiane" },
  { value: "REFERRAL", label: "Referral" }
];

// Percentage split per partner, keyed by who brought the project and whether
// supervising is required. Christiane isn't part of unsupervised projects,
// so that combination has no entry.
const SPLIT_TABLE = {
  required: {
    JASON: { Jason: 70, Jad: 15, Christiane: 15 },
    JAD: { Jason: 40, Jad: 40, Christiane: 20 },
    CHRISTIANE: { Jason: 40, Jad: 20, Christiane: 40 },
    REFERRAL: { Jason: 50, Jad: 25, Christiane: 25 }
  },
  notRequired: {
    JASON: { Jason: 70, Jad: 30 },
    JAD: { Jason: 60, Jad: 40 },
    REFERRAL: { Jason: 65, Jad: 35 }
  }
};

export function getSplitPercentages(broughtBy, supervisingRequired) {
  const table = SPLIT_TABLE[supervisingRequired ? "required" : "notRequired"];
  return table[broughtBy] || null;
}

export function isValidCombination(broughtBy, supervisingRequired) {
  return Boolean(getSplitPercentages(broughtBy, supervisingRequired));
}

export function computeSplitCents(amountCents, broughtBy, supervisingRequired) {
  const percentages = getSplitPercentages(broughtBy, supervisingRequired);
  if (!percentages) return null;

  const split = {};
  for (const partner of PARTNERS) {
    split[partner] = Math.round((amountCents * (percentages[partner] || 0)) / 100);
  }
  return split;
}
