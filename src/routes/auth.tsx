import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { signInWithGoogle } from "@/integrations/mongodb/auth.functions";
import { setSessionToken } from "@/integrations/mongodb/session-store";
import { notifySessionChanged } from "@/integrations/mongodb/use-session";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      toast.error("Google sign-in did not return a credential. Please try again.");
      return;
    }
    try {
      const { sessionToken } = await signInWithGoogle({
        data: { idToken: credentialResponse.credential },
      });
      setSessionToken(sessionToken);
      notifySessionChanged();
      toast.success("Welcome!");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Welcome</h1>
        <div className="flex flex-col items-center gap-4">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error("Google sign-in failed. Please try again.")}
          />
          <p className="text-center text-sm text-muted-foreground">
            Sign in with your Google account to continue.
          </p>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/">← Back to store</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
