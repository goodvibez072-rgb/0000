import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import Navigation from "@/components/Navigation";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const token = searchParams.get("token");
  
  const { verifyEmail, isVerifying, isSuccess, isError, error } = useEmailVerification();

  useEffect(() => {
    if (token) {
      verifyEmail({ token });
    }
  }, [token, verifyEmail]);

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setLocation("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, setLocation]);

  const getErrorMessage = () => {
    if (error && typeof error === 'object' && 'message' in error) {
      return (error as any).message;
    }
    return "Invalid or expired verification token.";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="w-20 h-20 mb-6 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center shadow-2xl shadow-primary/40">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Email Verification</h1>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-8">
            {!token && (
              <div className="text-center">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Invalid Link</h2>
                <p className="text-muted-foreground mb-6">
                  No verification token found. Please check your email for the correct link.
                </p>
                <Button
                  onClick={() => setLocation("/login")}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80"
                >
                  Go to Login
                </Button>
              </div>
            )}

            {token && isVerifying && (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Verifying Email</h2>
                <p className="text-muted-foreground">
                  Please wait while we verify your email address...
                </p>
              </div>
            )}

            {token && isSuccess && (
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Email Verified!</h2>
                <p className="text-muted-foreground mb-6">
                  Your email has been successfully verified. Redirecting to login...
                </p>
                <Button
                  onClick={() => setLocation("/login")}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80"
                >
                  Go to Login Now
                </Button>
              </div>
            )}

            {token && isError && (
              <div className="text-center">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Verification Failed</h2>
                <p className="text-muted-foreground mb-6">
                  {getErrorMessage()}
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => setLocation("/login")}
                    className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80"
                  >
                    Go to Login
                  </Button>
                  <Button
                    onClick={() => setLocation("/signup")}
                    variant="outline"
                    className="w-full"
                  >
                    Back to Signup
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
