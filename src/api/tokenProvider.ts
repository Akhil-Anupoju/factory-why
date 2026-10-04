// Token provider abstraction for non-React API modules.
// The AuthProvider registers a token getter function here so API modules
// can obtain an ID token without importing React hooks or Firebase directly.

type TokenGetter = () => Promise<string | null>;

let _getter: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter | null) {
  _getter = fn;
}

export async function getToken(): Promise<string | null> {
  if (!_getter) return null;
  try {
    return await _getter();
  } catch (e) {
    // Do not leak token retrieval errors or tokens; return null on error
    return null;
  }
}

export default {
  setTokenGetter,
  getToken,
};
