import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Github, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { loginUserSchema } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { SEO } from "@/components/SEO";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch enabled OAuth providers
  const { data: enabledProviders } = useQuery({
    queryKey: ["enabled-oauth-providers"],
    queryFn: async () => {
      const response = await fetch("/api/auth/oauth/enabled", {
        credentials: "include",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) {
        return { providers: [] };
      }
      return response.json();
    },
  });

  const form = useForm({
    resolver: zodResolver(loginUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      return apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: () => {
      // Invalidate and refetch authentication and currency queries
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currency/balance"] });
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
        variant: "success",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Please check your username and password.",
        variant: "error",
      });
    },
  });

  const onSubmit = (data: { username: string; password: string }) => {
    loginMutation.mutate(data);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !loginMutation.isPending) {
      event.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  // Get form errors for accessibility announcements
  const formErrors = form.formState.errors;
  const hasErrors = Object.keys(formErrors).length > 0;
  const errorMessage = formErrors.username?.message || formErrors.password?.message;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Login to Your AmourScans Account - Access Your Library"
        description="Sign in to AmourScans to access your personal manga library and reading history. Continue your manga journey and track your reading progress effortlessly."
        keywords="manga login, sign in, manga account, manga reader login, manhwa login"
      />
      <Navigation />
      
      {/* Aria-live region for form errors - Accessibility Enhancement */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {hasErrors && errorMessage && <span>Form error: {errorMessage}</span>}
        {loginMutation.isError && <span>Login error: {loginMutation.error?.message}</span>}
      </div>
      
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md px-4 sm:px-6 md:max-w-lg lg:max-w-xl">
        {/* Logo/Emblem */}
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="w-20 h-20 mb-6 flex items-center justify-center">
            <img 
              src="/amourscans-icon.png" 
              alt="AmourScans" 
              className="w-16 h-16 object-contain drop-shadow-2xl"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
        </div>
        <div className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Username or Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <Input
                          placeholder="Enter your username or email"
                          className="pl-10 h-12 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 rounded-lg backdrop-blur-sm"
                          data-testid="input-username"
                          autoComplete="username"
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Password</FormLabel>
                    <FormControl>
                      <div className="relative h-12">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <Input
                          type="password"
                          placeholder="••••••••••"
                          className="pl-10 h-12 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 rounded-lg backdrop-blur-sm"
                          data-testid="input-password"
                          autoComplete="current-password"
                          onKeyDown={handleKeyDown}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <div className="text-right mt-2">
                <Link href="/forgot-password">
                  <Button 
                    variant="ghost" 
                    className="p-0 h-auto text-sm text-muted-foreground hover:text-primary hover:bg-transparent"
                  >
                    Forgot password?
                  </Button>
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 mt-6 bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80 text-primary-foreground font-medium rounded-lg transition-all duration-200 shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : "Login"}
              </Button>
            </form>
          </Form>

          {/* Social Login Section */}
          {enabledProviders?.providers && enabledProviders.providers.length > 0 && (
            <div className="space-y-4">
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-4 py-1 text-muted-foreground rounded-md border border-border/50">Or continue with</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {enabledProviders.providers.includes('discord') && (
                  <Button 
                    type="button"
                    variant="outline" 
                    className="h-11 bg-card/50 border-border hover:bg-card/70 text-foreground transition-all duration-200 backdrop-blur-sm"
                    onClick={() => window.location.href = '/api/auth/discord'}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0019 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z" fill="#5865F2"/>
                    </svg>
                    <span className="ml-2 text-xs">Discord</span>
                  </Button>
                )}
                
                {enabledProviders.providers.includes('google') && (
                  <Button 
                    type="button"
                    variant="outline" 
                    className="h-11 bg-card/50 border-border hover:bg-card/70 text-foreground transition-all duration-200 backdrop-blur-sm"
                    onClick={() => window.location.href = '/api/auth/google'}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="ml-2 text-xs">Google</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Sign up link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Not a member?{" "}
              <Link href="/signup">
                <Button 
                  variant="ghost" 
                  className="p-0 h-auto text-blue-400 hover:underline font-medium"
                  data-testid="link-signup"
                >
                  Create New Account
                </Button>
              </Link>
            </p>
          </div>
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
          <p className="text-xs text-gray-400 mb-4">
            Read Comics, manga, manhwa. Translated swiftly. AmourScans your ultimate library.
          </p>
          <div className="flex justify-center items-center space-x-4 text-xs text-gray-600">
            <span>Privacy Policy</span>
            <span>•</span>
            <span>DMCA</span>
            <span>•</span>
            <Link href="/" className="text-xs text-gray-600 hover:underline hover:text-gray-400 transition-colors">
              Discord
            </Link>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}