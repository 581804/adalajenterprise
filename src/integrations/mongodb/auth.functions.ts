// Ships to the client bundle (it's how the client calls the server function),
// but contains no secrets itself — the actual verification/signing happens
// in auth.server.ts, loaded dynamically below so it never reaches the browser.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const googleSignInInput = z.object({
  idToken: z.string().min(1),
});

/**
 * Call from the client after Google's Sign-In JS returns an ID token:
 *
 *   const { sessionToken } = await signInWithGoogle({ data: { idToken } });
 *   setSessionToken(sessionToken);
 */
export const signInWithGoogle = createServerFn({ method: "POST" })
  .validator(googleSignInInput)
  .handler(async ({ data }) => {
    const { signInWithGoogleIdToken } = await import("./auth.server");
    const { sessionToken, claims } = await signInWithGoogleIdToken(data.idToken);
    return { sessionToken, email: claims.email, role: claims.role };
  });
