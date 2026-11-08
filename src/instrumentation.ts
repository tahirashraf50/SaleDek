export async function register() {
  // Only on the Node server runtime (not Edge / middleware).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Skip during `next build` collect phase when possible.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  try {
    const { ensureDatabase } = await import("@/lib/ensure-db");
    console.log("[instrumentation] ensuring MySQL schema…");
    const result = ensureDatabase();
    console.log(
      "[instrumentation] ensure-db:",
      result.ok ? "ok" : "failed",
      result.error ?? "",
    );
    for (const step of result.steps) {
      console.log(
        `[instrumentation] ${step.name}: ${step.ok ? "ok" : "FAIL"}`,
        step.output.slice(0, 500),
      );
    }
  } catch (err) {
    console.error("[instrumentation] ensure-db crashed:", err);
  }
}
