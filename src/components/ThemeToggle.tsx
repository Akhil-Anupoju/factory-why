import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { Theme } from '../theme';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="fw-theme-toggle"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
      <span>{dark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
};
