// Client-side. Decodes the locally-stored session JWT for UI purposes
// (e.g. "show admin nav if role === admin", "is anyone logged in"). This is
// NOT a security boundary — the payload is just base64, not verified here.
// Every server function independently re-verifies the token via
// verifySessionToken() in auth-middleware.ts, so a tampered token client-side
// only breaks the UI's own display, never grants real access.
import { useSyncExternalStore } from "react";
import { getSessionToken, clearSessionToken } from "./session-store";
import type { SessionClaims } from "./auth.server";

const SESSION_CHANGE_EVENT = "session-token-changed";

// Fired by anything that changes the stored token (sign-in, sign-out) so
// every useSession() consumer re-renders in sync, including across tabs
// (via the native `storage` event) and within the same tab.
export function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

function decodeClaims(token: string | null): SessionClaims | null {
  if (!token) return null;
  try {
    const payloadSegment = token.split(".")[1];
    const payload = JSON.parse(atob(payloadSegment.replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload?.sub || !payload?.email || !payload?.role) return null;
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(SESSION_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useSession(): { claims: SessionClaims | null; isAuthenticated: boolean } {
  const token = useSyncExternalStore(subscribe, getSessionToken, () => null);
  const claims = decodeClaims(token);
  return { claims, isAuthenticated: claims !== null };
}

export function signOut(): void {
  clearSessionToken();
  notifySessionChanged();
}
