import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Moon, Sun, Monitor, User, Mail, MapPin, Upload, LogOut, Lock, Loader2, Trophy, Star, Award, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { SEO } from "@/components/SEO";
import { fetchWithCsrf, fetchWithCsrfFormData } from "@/lib/csrf";

interface ProfileData {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  profilePicture?: string | null;
}

export default function Settings() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [, navigate] = useLocation();
  const { theme, setTheme } = useTheme();
  const { logout, isLoggingOut } = useLogout();
  const [profileData, setProfileData] = useState<ProfileData>({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    country: "",
    profilePicture: null
  });
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: ""
  });

  // Fetch achievements
  const { data: achievementsData, isLoading: achievementsLoading } = useQuery({
    queryKey: ['/api/achievements'],
    queryFn: async () => {
      const res = await fetch('/api/achievements', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch achievements');
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Fetch user's achievement progress
  const { data: userAchievements, isLoading: userAchievementsLoading } = useQuery({
    queryKey: ['/api/achievements/my-progress'],
    queryFn: async () => {
      const res = await fetch('/api/achievements/my-progress', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch user achievements');
      return res.json();
    },
    enabled: isAuthenticated
  });

  // Authentication guard - redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigate("/login?returnTo=/settings");
    }
  }, [isAuthLoading, isAuthenticated, navigate]);

  const { data: userProfile, isLoading: isLoadingProfile } = useQuery<ProfileData>({
    queryKey: ["/api/user/profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch profile");
      }
      const data = await res.json();
      return data.user;
    },
    enabled: isAuthenticated, // Only fetch profile when authenticated
    retry: false,
  });

  useEffect(() => {
    if (userProfile) {
      setProfileData({
        username: userProfile.username || "",
        email: userProfile.email || "",
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        country: userProfile.country || "",
        profilePicture: userProfile.profilePicture || null,
      });
    }
  }, [userProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      const res = await fetchWithCsrf("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
        variant: "success",
      });
      if (data.user) {
        setProfileData(prev => ({
          ...prev,
          username: data.user.username || prev.username,
          email: data.user.email || prev.email,
          firstName: data.user.firstName || prev.firstName,
          lastName: data.user.lastName || prev.lastName,
          country: data.user.country || prev.country,
        }));
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("profilePicture", file);
      
      const res = await fetchWithCsrfFormData("/api/user/profile-picture", formData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to upload profile picture");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setProfileData(prev => ({
        ...prev,
        profilePicture: data.profilePicture,
      }));
      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been uploaded successfully.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { oldPassword: string; newPassword: string }) => {
      const res = await fetchWithCsrf("/api/user/password", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
        variant: "success",
      });
      setPasswordData({ oldPassword: "", newPassword: "" });
      setIsPasswordDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Password Change Failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const handleProfilePictureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Profile picture must be less than 5MB.",
          variant: "error",
        });
        return;
      }
      uploadProfilePictureMutation.mutate(file);
    }
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      username: profileData.username,
      email: profileData.email,
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      country: profileData.country,
    });
  };

  const handleChangePassword = () => {
    if (!passwordData.oldPassword || !passwordData.newPassword) {
      toast({
        title: "Missing Fields",
        description: "Please fill in both password fields.",
        variant: "error",
      });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Invalid Password",
        description: "New password must be at least 8 characters long.",
        variant: "error",
      });
      return;
    }
    changePasswordMutation.mutate(passwordData);
  };

  // Show loading state while checking authentication or loading profile
  if (isAuthLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render settings if not authenticated (will redirect via useEffect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-4">
      <SEO 
        title="Account Settings - Manage Your AmourScans Profile"
        description="Manage your AmourScans profile, preferences, and account security settings. Update your password, profile picture, and customize your reading experience."
        keywords="account settings, profile settings, manga preferences, user settings, account security"
      />
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="min-h-11 w-fit text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-8 h-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Profile Information</span>
                </CardTitle>
                <CardDescription>
                  Manage your profile details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={profileData.profilePicture || undefined} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {profileData.username?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor="profile-upload" className="absolute -bottom-2 -right-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-2 cursor-pointer shadow-lg transition-colors">
                      {uploadProfilePictureMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <input
                        id="profile-upload"
                        type="file"
                        accept="image/*"
                        autoComplete="off"
                        onChange={handleProfilePictureUpload}
                        className="hidden"
                        disabled={uploadProfilePictureMutation.isPending}
                      />
                    </label>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Upload a profile picture. Max size: 5MB. Recommended: 400x400px
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={profileData.username}
                      onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                      className="h-12 bg-background/50"
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        className="h-12 bg-background/50 pl-10"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name (Optional)</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="h-12 bg-background/50"
                      placeholder="John"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name (Optional)</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="h-12 bg-background/50"
                      placeholder="Doe"
                      autoComplete="family-name"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="country">Country (Optional)</Label>
                    <input
                      type="text"
                      name="country"
                      autoComplete="country-name"
                      value={profileData.country || ""}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="absolute -left-[9999px] w-1 h-1 opacity-0"
                      onChange={(e) => {
                        setProfileData({ ...profileData, country: e.target.value });
                      }}
                    />
                    <Select 
                      value={profileData.country} 
                      onValueChange={(value) => setProfileData(prev => ({ ...prev, country: value }))}
                    >
                      <SelectTrigger className="h-12 bg-background/50">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <SelectValue placeholder="Select your country" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">United States</SelectItem>
                        <SelectItem value="ca">Canada</SelectItem>
                        <SelectItem value="uk">United Kingdom</SelectItem>
                        <SelectItem value="jp">Japan</SelectItem>
                        <SelectItem value="kr">South Korea</SelectItem>
                        <SelectItem value="fr">France</SelectItem>
                        <SelectItem value="de">Germany</SelectItem>
                        <SelectItem value="au">Australia</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    className="min-h-11 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white"
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle>Account Security</CardTitle>
                <CardDescription>
                  Manage your password and account security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Change Password</p>
                    <p className="text-sm text-muted-foreground">Update your password for security</p>
                  </div>
                  <Button variant="outline" className="min-h-11" onClick={() => setIsPasswordDialogOpen(true)}>
                    <Lock className="w-4 h-4 mr-2" />
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Achievements Section */}
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <span>Achievements</span>
                </CardTitle>
                <CardDescription>
                  Track your reading milestones and accomplishments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {achievementsLoading || userAchievementsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="h-20 bg-background/50 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : achievementsData && achievementsData.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {achievementsData.map((achievement: any) => {
                      const earned = userAchievements?.some((ua: any) => ua.achievementId === achievement.id);
                      
                      return (
                        <div 
                          key={achievement.id}
                          className={`p-3 rounded-lg border transition-all ${
                            earned 
                              ? 'bg-primary/10 border-primary/50 hover:bg-primary/20' 
                              : 'bg-background/30 border-border/30 opacity-50 grayscale'
                          }`}
                        >
                          <div className="flex flex-col items-center text-center gap-2">
                            {achievement.badgeIcon ? (
                              <span className="text-2xl">{achievement.badgeIcon}</span>
                            ) : (
                              <Award className={`w-8 h-8 ${earned ? 'text-primary' : 'text-muted-foreground'}`} />
                            )}
                            <div>
                              <p className={`text-sm font-semibold ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {achievement.name}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {achievement.description}
                              </p>
                              {earned && achievement.coinReward > 0 && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  +{achievement.coinReward} coins
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No achievements available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Monitor className="w-5 h-5" />
                  <span>Appearance</span>
                </CardTitle>
                <CardDescription>
                  Customize how AmourScans looks and feels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Theme Preference</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { value: "light", label: "Light", icon: Sun },
                      { value: "dark", label: "Dark", icon: Moon },
                      { value: "system", label: "System", icon: Monitor }
                    ].map((option) => {
                      const Icon = option.icon;
                      return (
                        <Button
                          key={option.value}
                          variant={theme === option.value ? "default" : "outline"}
                          className="justify-start"
                          onClick={() => setTheme(option.value)}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => logout()}
                  disabled={isLoggingOut}
                  data-testid="settings-logout-button"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {isLoggingOut ? "Signing out..." : "Sign Out"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and a new password to update your account security.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordData.oldPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, oldPassword: e.target.value }))}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Enter new password (min 8 characters)"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsPasswordDialogOpen(false);
              setPasswordData({ oldPassword: "", newPassword: "" });
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
