import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, XCircle, Key } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithCsrf } from "@/lib/csrf";

interface OAuthProvider {
  enabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
}

interface OAuthProvidersConfig {
  google: OAuthProvider;
  discord: OAuthProvider;
}

async function fetchOAuthProviders(): Promise<OAuthProvidersConfig> {
  const response = await fetch("/api/admin/oauth/providers", {
    credentials: "include",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch OAuth providers");
  }

  return response.json();
}

async function updateOAuthProvider(provider: string, config: {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
}) {
  const response = await fetchWithCsrf(`/api/admin/oauth/providers/${provider}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to update ${provider} OAuth provider`);
  }

  return response.json();
}

export function OAuthProvidersControl() {
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState<{ google: boolean; discord: boolean }>({
    google: false,
    discord: false,
  });
  const [formData, setFormData] = useState<{
    google: { clientId: string; clientSecret: string };
    discord: { clientId: string; clientSecret: string };
  }>({
    google: { clientId: "", clientSecret: "" },
    discord: { clientId: "", clientSecret: "" },
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: ["oauth-providers"],
    queryFn: fetchOAuthProviders,
  });

  const updateProviderMutation = useMutation({
    mutationFn: ({ provider, config }: { provider: string; config: any }) =>
      updateOAuthProvider(provider, config),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["oauth-providers"] });
      const providerName = variables.provider.charAt(0).toUpperCase() + variables.provider.slice(1);
      toast({
        title: "Success",
        description: `${providerName} OAuth configuration updated successfully`,
      });
      setFormData(prev => ({
        ...prev,
        [variables.provider]: { clientId: "", clientSecret: "" },
      }));
    },
    onError: (error: Error, variables) => {
      const providerName = variables.provider.charAt(0).toUpperCase() + variables.provider.slice(1);
      toast({
        title: "Error",
        description: error.message || `Failed to update ${providerName} OAuth configuration`,
        variant: "error",
      });
    },
  });

  const handleToggleProvider = (provider: 'google' | 'discord', enabled: boolean) => {
    updateProviderMutation.mutate({
      provider,
      config: { enabled },
    });
  };

  const handleUpdateCredentials = (provider: 'google' | 'discord') => {
    const data = formData[provider];
    
    if (!data.clientId && !data.clientSecret) {
      toast({
        title: "Validation Error",
        description: "Please provide at least one credential to update",
        variant: "error",
      });
      return;
    }

    updateProviderMutation.mutate({
      provider,
      config: {
        clientId: data.clientId || undefined,
        clientSecret: data.clientSecret || undefined,
      },
    });
  };

  const renderProviderCard = (
    provider: 'google' | 'discord',
    providerName: string,
    icon: string
  ) => {
    const config = providers?.[provider];
    if (!config) return null;

    return (
      <Card key={provider} className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {icon === 'google' && (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                {icon === 'discord' && (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#5865F2">
                    <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
                  </svg>
                )}
              </div>
              <div>
                <CardTitle className="text-lg">{providerName} OAuth</CardTitle>
                <CardDescription className="text-sm">
                  Configure {providerName} authentication
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {config.enabled ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="w-3 h-3 mr-1" />
                  Disabled
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <Switch
                checked={config.enabled}
                onCheckedChange={(enabled) => handleToggleProvider(provider, enabled)}
                disabled={updateProviderMutation.isPending}
              />
              <Label className="text-sm font-medium cursor-pointer">
                Enable {providerName} Login
              </Label>
            </div>
          </div>

          <div className="space-y-3 p-4 border rounded-lg">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Key className="w-4 h-4" />
              OAuth Credentials
            </h4>
            
            <div className="space-y-2">
              <Label htmlFor={`${provider}-client-id`}>Client ID</Label>
              <div className="flex gap-2">
                <Input
                  id={`${provider}-client-id`}
                  type="text"
                  placeholder={config.clientId ? "••••••••" : "Enter new Client ID"}
                  value={formData[provider].clientId}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      [provider]: { ...prev[provider], clientId: e.target.value },
                    }))
                  }
                  className="flex-1"
                />
              </div>
              {config.clientId && (
                <p className="text-xs text-muted-foreground">
                  Current: {config.clientId.substring(0, 20)}...
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${provider}-client-secret`}>Client Secret</Label>
              <div className="flex gap-2">
                <Input
                  id={`${provider}-client-secret`}
                  type={showSecrets[provider] ? "text" : "password"}
                  placeholder={config.hasClientSecret ? "••••••••" : "Enter new Client Secret"}
                  value={formData[provider].clientSecret}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      [provider]: { ...prev[provider], clientSecret: e.target.value },
                    }))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setShowSecrets((prev) => ({ ...prev, [provider]: !prev[provider] }))
                  }
                >
                  {showSecrets[provider] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {config.hasClientSecret && (
                <p className="text-xs text-muted-foreground">
                  Secret is configured (hidden for security)
                </p>
              )}
            </div>

            <Button
              onClick={() => handleUpdateCredentials(provider)}
              disabled={
                updateProviderMutation.isPending ||
                (!formData[provider].clientId && !formData[provider].clientSecret)
              }
              className="w-full"
            >
              {updateProviderMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Update Credentials
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Create OAuth credentials in the{" "}
                {provider === "google" ? (
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Cloud Console
                  </a>
                ) : (
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Discord Developer Portal
                  </a>
                )}
              </li>
              <li>Add your callback URL: <code className="text-xs bg-background px-1 rounded">/api/auth/{provider}/callback</code></li>
              <li>Enter the Client ID and Client Secret above</li>
              <li>Enable the provider to allow user authentication</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            OAuth Authentication Providers
          </CardTitle>
          <CardDescription>
            Configure external authentication providers to allow users to sign in with their existing accounts.
            Only owners can manage these settings.
          </CardDescription>
        </CardHeader>
      </Card>

      {renderProviderCard("google", "Google", "google")}
      {renderProviderCard("discord", "Discord", "discord")}
    </div>
  );
}
