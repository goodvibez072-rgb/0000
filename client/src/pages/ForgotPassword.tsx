import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, ArrowLeft, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForgotPassword } from "@/hooks/usePasswordReset";
import Navigation from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { forgotPassword, isLoading, isSuccess } = useForgotPassword();

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    forgotPassword(data);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Forgot Password - AmourScans"
        description="Reset your AmourScans account password. Enter your email address to receive password reset instructions."
        keywords="forgot password, reset password, manga account recovery"
      />
      <Navigation />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md px-4 sm:px-6 md:max-w-lg lg:max-w-xl">
          {/* Logo/Emblem */}
          <div className="flex flex-col items-center justify-center mb-12">
            <div className="w-20 h-20 mb-6 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center shadow-2xl shadow-primary/40">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Forgot Password</h1>
            <p className="text-muted-foreground text-center text-sm">
              Enter your email and we'll send you reset instructions
            </p>
          </div>

          {/* Back Button */}
          <Button
            variant="ghost"
            className="mb-4 text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/login")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>

          <div className="space-y-6">
            {!isSuccess ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
                            <Input
                              type="email"
                              placeholder="your@example.com"
                              className="pl-10 h-12 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 rounded-lg backdrop-blur-sm"
                              autoComplete="email"
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
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-8 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Check Your Email</h2>
                <p className="text-muted-foreground mb-6">
                  If an account with that email exists, we've sent password reset instructions.
                </p>
                <Button
                  onClick={() => setLocation("/login")}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80"
                >
                  Back to Login
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold text-foreground">
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
