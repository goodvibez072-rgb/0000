import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VerifyEmailParams {
  token: string;
}

export function useEmailVerification() {
  const { toast } = useToast();

  const verifyEmailMutation = useMutation({
    mutationFn: async ({ token }: VerifyEmailParams) => {
      return apiRequest("POST", "/api/auth/verify-email", { token });
    },
    onSuccess: () => {
      toast({
        title: "Email verified!",
        description: "Your email has been successfully verified. You can now log in.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid or expired verification token.",
        variant: "error",
      });
    },
  });

  return {
    verifyEmail: verifyEmailMutation.mutate,
    isVerifying: verifyEmailMutation.isPending,
    isSuccess: verifyEmailMutation.isSuccess,
    isError: verifyEmailMutation.isError,
    error: verifyEmailMutation.error,
  };
}

export function useResendVerification() {
  const { toast } = useToast();

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/request-verification", {});
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "Please check your email for the verification link.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send email",
        description: error.message || "Could not send verification email. Please try again.",
        variant: "error",
      });
    },
  });

  return {
    resendVerification: resendVerificationMutation.mutate,
    isResending: resendVerificationMutation.isPending,
  };
}
