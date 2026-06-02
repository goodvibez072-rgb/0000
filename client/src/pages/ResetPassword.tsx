import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useResetPassword, useVerifyResetToken } from "@/hooks/usePasswordReset";
import Navigation from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { z } from "zod";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const token = searchParams.get("token");

  const { verifyToken, isVerifying, isSuccess: isTokenValid, isError: isTokenInvalid } = useVerifyResetToken();
  const { resetPassword, isResetting, isSuccess: isResetSuccess } = useResetPassword();

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Verify token on component mount
  useEffect(() => {
    if (token) {
      verifyToken({ token });
    }
  }, [token, verifyToken]);

  // Redirect to login after successful reset
  useEffect(() => {
    if (isResetSuccess) {
      const timer = setTimeout(() => {
        setLocation("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isResetSuccess, setLocation]);

  const onSubmit = (data: ResetPasswordFormData) => {
    if (token) {
      resetPassword({
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isResetting) {
      event.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Reset Password - AmourScans"
        description="Create a new password for your AmourScans account."
        keywords="reset password, new password, manga account security"
      />
      <Navigation />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md px-4 sm:px-6 md:max-w-lg lg:max-w-xl">
          <div className="flex flex-col items-center justify-center mb-12">
            <div className="w-20 h-20 mb-6 flex items-center justify-center">
              <img 
                src="/amourscans-icon.png" 
                alt="AmourScans" 
                className="w-16 h-16 object-contain drop-shadow-2xl"
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Reset Password</h1>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-8">
            {!token && (
              <div className="text-center">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Invalid Link</h2>
                <p className="text-muted-foreground mb-6">
                  No reset token found. Please check your email for the correct link.
                </p>
                <Button
                  onClick={() => setLocation("/forgot-password")}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80"
                >
                  Request New Link
                </Button>
              </div>
            )}

            {token && isVerifying && (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Verifying Link</h2>
                <p className="text-muted-foreground">
                  Please wait while we verify your reset link...
                </p>
              </div>
            )}

            {token && isTokenInvalid && (
              <div className="text-center">
                <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Invalid or Expired Link</h2>
                <p className="text-muted-foreground mb-6">
                  This password reset link is invalid or has expired. Please request a new one.
                </p>
                <Button
                  onClick={() => setLocation("/forgot-password")}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80"
                >
                  Request New Link
                </Button>
              </div>
            )}

            {token && isTokenValid && !isResetSuccess && (
              <>
                <Button
                  variant="ghost"
                  className="mb-4 text-muted-foreground hover:text-foreground"
                  onClick={() => setLocation("/login")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              <Input
                                type="password"
                                placeholder="••••••••••"
                                className="pl-10 h-12 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 rounded-lg backdrop-blur-sm"
                                autoComplete="new-password"
                                onKeyDown={handleKeyDown}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Confirm New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              <Input
                                type="password"
                                placeholder="••••••••••"
                                className="pl-10 h-12 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 rounded-lg backdrop-blur-sm"
                                autoComplete="new-password"
                                onKeyDown={handleKeyDown}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full h-12 mt-6 bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80 text-primary-foreground font-medium rounded-lg transition-all duration-200 shadow-lg shadow-primary/30"
                      disabled={isResetting}
                    >
                      {isResetting ? "Resetting Password..." : "Reset Password"}
                    </Button>
                  </form>
                </Form>
              </>
            )}

            {token && isResetSuccess && (
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Password Reset Successful!</h2>
                <p className="text-muted-foreground mb-6">
                  Your password has been reset. Redirecting to login...
                </p>
                <Button
                  onClick={() => setLocation("/login")}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80"
                >
                  Go to Login Now
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <img 
                src="/amourscans-icon.png" 
                alt="AmourScans" 
                className="w-5 h-5 object-contain"
              />
              <span className="text-lg font-bold bg-gradient-to-r from-[#a195f9] via-[#f2a1f2] to-[#f2a1f2] bg-clip-text text-transparent">
                AmourScans
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Read Comics, manga, manhwa. Translated swiftly. AmourScans your ultimate library.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
