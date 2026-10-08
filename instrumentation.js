// Runs once per server process. Starts the background sweep that sends
// scheduled invoices once their sendAt time has passed.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (globalThis.__scheduledInvoicesStarted) return;
  globalThis.__scheduledInvoicesStarted = true;

  const { processDueInvoices } = await import("@/lib/scheduled-invoices");

  const sweep = () => {
    processDueInvoices().catch((err) => {
      console.error("Scheduled invoice sweep failed:", err.message);
    });
  };

  // First sweep shortly after startup, then every 60 seconds.
  const startup = setTimeout(sweep, 10 * 1000);
  startup.unref?.();

  const timer = setInterval(sweep, 60 * 1000);
  timer.unref?.();
}
