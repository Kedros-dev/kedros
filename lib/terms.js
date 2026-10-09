export const TERMS_VERSION = 1;
export const TERMS_REPROMPT_EVERY_LOGINS = 3;

// Re-prompt when the terms version changed, or when 3 or more logins have happened since the last acceptance.
// Applies to CLIENT users only.
export function mustAcceptTerms(user) {
  if (!user) return false;
  if (user.role !== "CLIENT") return false;
  const loginCount = user.loginCount ?? 0;
  const termsAcceptedAtLogin = user.termsAcceptedAtLogin ?? 0;
  return (
    user.termsVersion !== TERMS_VERSION ||
    loginCount - termsAcceptedAtLogin >= TERMS_REPROMPT_EVERY_LOGINS
  );
}

export const TERMS_CONTENT = {
  title: "Service Terms",
  subtitle: "Kedros Business Development",
  intro: "Welcome to your Kedros account. Here you can check your website's status and pay your bills. Please review and accept the terms below to continue.",
  items: [
    {
      badge: "Included",
      tone: "included",
      title: "Maintenance & support",
      text: "Maintenance, bug fixes and small text or image edits are covered at no extra cost."
    },
    {
      badge: "From $20",
      tone: "price",
      title: "Simple additions",
      text: "Small changes or additions to your website that take little time to complete. Charged per addition."
    },
    {
      badge: "From $50",
      tone: "price",
      title: "New features",
      text: "Larger additions that add new functionality to your website. The price depends on the work involved and is quoted before work starts."
    }
  ],
  footnote: "Any paid work is confirmed with you in writing before it starts. Kedros decides whether a request is a minor fix, a simple addition or a new feature, and tells you the price upfront.",
  checkboxLabel: "I have read and agree to the Kedros service terms.",
  buttonLabel: "Accept & Continue"
};
