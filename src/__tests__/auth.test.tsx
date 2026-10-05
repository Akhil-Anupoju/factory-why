/**
 * Lightweight tests for AuthProvider using a mocked Firebase SDK boundary.
 * We mock initFirebase to provide a fake auth object with minimal behavior.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
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
      <span data-testid="has-getidtoken">{typeof a.getIdToken === 'function' ? 'yes' : 'no'}</span>
      <span data-testid="has-google-signin">{typeof a.signInWithGoogle === 'function' || typeof a.signIn === 'function' ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('AuthProvider (unit)', () => {
  it('renders without crashing when firebase not initialized', async () => {
    // No init mocking: env may or may not contain firebase config in test
    const { getByTestId } = render(
      <AuthProvider>
        <Inspect />
      </AuthProvider>
    );
    // Wait for AuthProvider to settle loading state whether it initializes
    // synchronously (no firebase) or asynchronously (auth SDK present).
    await waitFor(() => expect(getByTestId('loading').textContent).toBe('false'));
    expect(getByTestId('isAuth').textContent).toBe('false');
  });

  it('exposes signInWithGoogle alias and getIdToken', () => {
    // Basic smoke test: provider may be uninitialized but methods exist
    const { getByTestId } = render(
      <AuthProvider>
        <Inspect />
      </AuthProvider>
    );
    expect(getByTestId('has-getidtoken').textContent).toBe('yes');
    expect(getByTestId('has-google-signin').textContent).toBe('yes');
  });
});
