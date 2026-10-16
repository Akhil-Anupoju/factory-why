import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, readStoredTheme, saveTheme } from '../theme';

describe('theme selection', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
    window.localStorage.clear();
  });

  it('applies and persists dark mode on the document root', () => {
    applyTheme('dark');
    saveTheme('dark');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('removes dark mode when switched back to light', () => {
    applyTheme('dark');
    applyTheme('light');
    saveTheme('light');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(readStoredTheme()).toBe('light');
  });
});
