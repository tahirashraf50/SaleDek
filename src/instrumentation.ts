/**
 * Intentionally minimal: do NOT import Node built-ins or ensure-db here.
 * Next compiles instrumentation for Edge + Node; Node-only DB setup runs via
 * `npm start` → scripts/db-bootstrap.mjs and /api/setup-db.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log(
      "[instrumentation] SaleDek Node runtime ready (DB bootstrap via npm start /api/setup-db)",
    );
  }
}
