/** Minimal Vitest config compatible with the repo's Vite version and TypeScript setup.
 * We use CJS here to avoid type resolution issues when tsc reads project files.
 */
module.exports = {
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/vitest.setup.ts'],
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx,js}'],
    testTimeout: 10000,
  },
};
