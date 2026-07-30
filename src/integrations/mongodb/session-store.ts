// Client-side only. Thin wrapper around localStorage for the session JWT
// issued by our /api/auth/google server function. Replaces the persistence
// Supabase's client SDK used to handle internally (auth.getSession()).
const STORAGE_KEY = "session_token";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearSessionToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
