// Server-only auth logic: verifies Google ID tokens, upserts the
// corresponding MongoDB user, and issues/verifies this app's own session
// JWT. Never import from route files or client components — GOOGLE_CLIENT_ID
// is fine client-side, but this module also touches SESSION_JWT_SECRET.
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { connectMongo } from "./client.server";
import { User, type UserRole } from "./models/user.server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : undefined;

export type SessionClaims = {
  sub: string; // MongoDB user _id, as a string
  email: string;
  role: UserRole;
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    const message = `Missing environment variable: ${name}. Set it in your .env file.`;
    console.error(`[Auth] ${message}`);
    throw new Error(message);
  }
  return value;
}

/**
 * Verify a Google ID token (obtained client-side from Google's Sign-In
 * button), upsert the matching user in MongoDB, and return our own signed
 * session token for the browser to use on subsequent requests.
 *
 * This is the server-side half of the OAuth flow — the Client Secret's
 * corresponding piece (used only for the authorization-code flow) is not
 * needed here because Google's One Tap / Sign-In JS SDK returns an ID token
 * directly; verifying it needs only the Client ID. Keep GOOGLE_CLIENT_SECRET
 * out of this file unless the flow changes to authorization-code exchange.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<{ sessionToken: string; claims: SessionClaims }> {
  const client = googleClient ?? new OAuth2Client(requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID));

  const ticket = await client.verifyIdToken({
    idToken,
    audience: requireEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID),
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("Unauthorized: Invalid Google ID token payload");
  }

  await connectMongo();

  // Replaces the bootstrap_first_admin Postgres trigger: the very first user
  // ever created becomes admin automatically, so there's always at least one
  // admin without a manual DB edit. Only matters on the insert path (a
  // returning user's role should never be silently changed here).
  const isFirstEverUser = (await User.estimatedDocumentCount()) === 0;

  const user = await User.findOneAndUpdate(
    { googleId: payload.sub },
    {
      $set: {
        email: payload.email,
        emailVerified: payload.email_verified ?? false,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture,
      },
      $setOnInsert: {
        googleId: payload.sub,
        role: isFirstEverUser ? "admin" : "customer",
      },
    },
    { upsert: true, new: true },
  );

  const claims: SessionClaims = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role as UserRole,
  };

  const sessionToken = jwt.sign(claims, requireEnv("SESSION_JWT_SECRET", SESSION_JWT_SECRET), {
    expiresIn: SESSION_TTL_SECONDS,
  });

  return { sessionToken, claims };
}

/**
 * Verify one of our own session JWTs (issued above). Throws on any
 * invalid/expired/malformed token — callers should catch and translate to a
 * 401, mirroring the old requireSupabaseAuth behavior.
 */
export function verifySessionToken(token: string): SessionClaims {
  const decoded = jwt.verify(token, requireEnv("SESSION_JWT_SECRET", SESSION_JWT_SECRET));
  if (typeof decoded === "string" || !decoded.sub || !decoded.email || !decoded.role) {
    throw new Error("Unauthorized: Invalid session token");
  }
  return { sub: decoded.sub as string, email: decoded.email as string, role: decoded.role as UserRole };
}
