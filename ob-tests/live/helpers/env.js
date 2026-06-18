// Reads the env needed for the LIVE smoke tests. If anything is missing,
// the specs SKIP (they never run with placeholders), so this is safe to keep in CI.
const REQUIRED = ['LIVE_APP_URL', 'LIVE_ADMIN_URL', 'ADMIN_TEST_EMAIL', 'ADMIN_TEST_PASSWORD'];

function missing() { return REQUIRED.filter((k) => !process.env[k]); }
function liveConfigured() { return missing().length === 0; }
function skipReason() {
  return 'LIVE smoke not configured — set these env vars / GitHub secrets to run: ' + missing().join(', ');
}
function cfg() {
  return {
    appUrl: process.env.LIVE_APP_URL,
    adminUrl: process.env.LIVE_ADMIN_URL,
    apiBase: process.env.LIVE_API_BASE || '',
    email: process.env.ADMIN_TEST_EMAIL,
    password: process.env.ADMIN_TEST_PASSWORD,
  };
}
module.exports = { REQUIRED, missing, liveConfigured, skipReason, cfg };
