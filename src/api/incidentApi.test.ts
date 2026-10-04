import { fetchIncident, ApiError } from './incidentApi';

// Simple smoke tests without a test runner; exported for manual invocation
// retain a lightweight manual-run helper but avoid noisy console output in CI
async function runTests() {
  try {
    await fetchIncident('NON-EXISTENT-INCIDENT');
    throw new Error('Expected not found error');
  } catch (err: any) {
    if (err instanceof ApiError) {
      // success path for manual invocation - return a string so callers can
      // inspect without noisy logging
      return `ApiError:${err.status}:${err.message}`;
    }
    throw err;
  }
}

if (require.main === module) {
  // when executed manually, print a short message (acceptable for local dev)
  runTests().then((r) => console.log('incidentApi manual test result:', r)).catch((e) => console.error('incidentApi manual test failed:', e));
}

export default {};
