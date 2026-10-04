/**
 * Lightweight tests for AuthProvider using a mocked Firebase SDK boundary.
 * We mock initFirebase to provide a fake auth object with minimal behavior.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from '../auth/AuthContext';

// Simple component to inspect auth state
function Inspect() {
  const a = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(a.loading)}</span>
      <span data-testid="isAuth">{String(a.isAuthenticated)}</span>
      <span data-testid="user">{a.user?.email || ''}</span>
    </div>
  );
}

describe('AuthProvider (unit)', () => {
  it('renders without crashing when firebase not initialized', () => {
    // No init mocking: env may not contain firebase config in test
    const { getByTestId } = render(
      <AuthProvider>
        <Inspect />
      </AuthProvider>
    );
    expect(getByTestId('loading').textContent).toBe('false');
    expect(getByTestId('isAuth').textContent).toBe('false');
  });
});
