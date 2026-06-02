import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, User, Mail, Camera, Upload, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { signupUserSchema } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { z } from "zod";

type SignupFormData = z.infer<typeof signupUserSchema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  
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

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      profilePicture: "",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      return apiRequest("POST", "/api/auth/signup", data);
    },
    onSuccess: () => {
      // Invalidate auth queries to ensure fresh state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Account created!",
        description: "Welcome to AmourScans. Please log in to continue.",
        variant: "success",
      });
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error.message || "Unable to create account. Please try again.",
        variant: "error",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    // Include confirmPassword for backend validation, profile picture from state
    signupMutation.mutate({
      ...data,
      profilePicture: profilePicture || ""
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !signupMutation.isPending) {
      event.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 2MB.",
          variant: "error",
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (JPG, PNG, etc.).",
          variant: "error",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfilePicture(result);
        form.setValue("profilePicture", result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Create Your Free AmourScans Account - Sign Up Today"
        description="Create your free manga reader account and start exploring thousands of manga series. Track your reading progress, build your library, and discover new favorites today."
        keywords="manga signup, create account, manga registration, free manga account, join manga reader"
      />
      <Navigation />
      <div className="flex items-center justify-center p-4 pt-20">
        <div className="w-full max-w-md px-4 sm:px-6 md:max-w-lg lg:max-w-xl">
        {/* Logo/Emblem */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-20 h-20 mb-4 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center shadow-2xl shadow-primary/40">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Create New Account</h1>
          <p className="text-muted-foreground text-center text-sm sm:text-base">Join AmourScans to start your manga journey</p>
        </div>

        <div className="space-y-6">
          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center space-y-3 mb-6">
            <div className="relative group">
              <div className="w-[77px] h-[77px] rounded-full bg-card/50 border-2 border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary hover:scale-105 transition-all duration-300 backdrop-blur-sm">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <input
                id="profile-picture-upload"
                type="file"
                accept="image/*"
                autoComplete="off"
                onChange={handleProfilePictureChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-300">
                <Upload className="w-3 h-3 text-white" />
              </div>
            </div>
            <label htmlFor="profile-picture-upload" className="text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors">
              Choose Picture
            </label>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Username Field */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
                        <Input
                          placeholder="Enter your username"
                          className="pl-10 h-12 bg-card/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 rounded-lg backdrop-blur-sm"
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

              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Email</FormLabel>
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

                  {/* Password Field */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <Input
                              type="password"
                              placeholder="•••••••••••"
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

                  {/* Confirm Password Field */}
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <Input
                              type="password"
                              placeholder="•••••••••••"
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


              {/* Register Button */}
              <Button
                type="submit"
                disabled={signupMutation.isPending}
                className="w-full h-12 mt-6 bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80 text-primary-foreground font-medium rounded-lg transition-all duration-200 shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : "Create Account"}
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

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{" "}
              <Link href="/login">
                <Button 
                  variant="ghost" 
                  className="p-0 h-auto text-blue-400 underline cursor-pointer font-medium"
                >
                  Login
                </Button>
              </Link>
            </p>
          </div>
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
          <div className="flex justify-center space-x-4 text-xs text-muted-foreground">
            <span>Privacy Policy</span>
            <span>•</span>
            <span>DMCA</span>
            <span>•</span>
            <span>Discord</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}