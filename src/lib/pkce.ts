/**
 * PKCE (Proof Key for Code Exchange) utility functions
 * Used for secure OAuth 2.0 authorization with Authorization Code flow
 * 
 * Implements RFC 7636: https://tools.ietf.org/html/rfc7636
 * Framework-agnostic, uses Web Crypto API
 */

/**
 * Generate a cryptographically random code verifier
 * @param length - Length of the verifier (43-128 characters, default 64)
 * @returns URL-safe random string
 */
export const generateCodeVerifier = (length: number = 64): string => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  return Array.from(randomValues)
    .map((x) => possible[x % possible.length])
    .join('');
};

/**
 * SHA-256 hash function
 * @param input - String to hash
 * @returns Promise resolving to ArrayBuffer containing the hash
 */
export const sha256 = async (input: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  return await crypto.subtle.digest('SHA-256', data);
};

/**
 * Base64-URL encode a buffer (without padding)
 * Converts ArrayBuffer to base64url format as per RFC 4648 §5
 * @param buffer - ArrayBuffer to encode
 * @returns Base64-URL encoded string (no padding)
 */
export const base64UrlEncode = (buffer: ArrayBuffer): string => {
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
 * Generate code challenge from code verifier using S256 method
 * @param verifier - The code verifier string
 * @returns Promise resolving to base64url-encoded SHA256 hash
 */
export const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
};
