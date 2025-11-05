/**
 * PKCE (Proof Key for Code Exchange) utility functions
 * Used for secure OAuth 2.0 authorization in mobile apps
 */

/**
 * Generate a random string for code verifier
 * Must be between 43-128 characters, using A-Z, a-z, 0-9, and the punctuation characters -._~ (hyphen, period, underscore, and tilde)
 */
export const generateCodeVerifier = (): string => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(64);
  crypto.getRandomValues(randomValues);
  
  return Array.from(randomValues)
    .map((x) => possible[x % possible.length])
    .join('');
};

/**
 * Generate code challenge from code verifier using SHA-256
 * @param verifier - The code verifier string
 * @returns Base64-URL-encoded SHA256 hash of the verifier
 */
export const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64url encoding
  return base64UrlEncode(digest);
};

/**
 * Base64-URL encode a buffer
 * @param buffer - ArrayBuffer to encode
 * @returns Base64-URL encoded string
 */
const base64UrlEncode = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Generate a random state parameter for OAuth
 * Used to prevent CSRF attacks
 */
export const generateState = (): string => {
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  
  return Array.from(randomValues, (byte) => byte.toString(16).padStart(2, '0')).join('');
};
