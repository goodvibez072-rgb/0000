import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ForgotPasswordParams {
  email: string;
}

interface ResetPasswordParams {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

interface VerifyResetTokenParams {
  token: string;
}

export function useForgotPassword() {
  const { toast } = useToast();

  const forgotPasswordMutation = useMutation({
    mutationFn: async ({ email }: ForgotPasswordParams) => {
      return apiRequest("POST", "/api/auth/forgot-password", { email });
    },
    onSuccess: () => {
      toast({
        title: "Email sent!",
        description: "If an account with that email exists, a password reset link has been sent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Request failed",
        description: error.message || "Failed to process password reset request. Please try again.",
        variant: "error",
      });
    },
  });

  return {
    forgotPassword: forgotPasswordMutation.mutate,
    isLoading: forgotPasswordMutation.isPending,
    isSuccess: forgotPasswordMutation.isSuccess,
  };
}

export function useResetPassword() {
  const { toast } = useToast();

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, newPassword, confirmPassword }: ResetPasswordParams) => {
      return apiRequest("POST", "/api/auth/reset-password", {
        token,
        newPassword,
        confirmPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful!",
        description: "Your password has been reset. You can now log in with your new password.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Failed to reset password. Please try again.",
        variant: "error",
      });
    },
  });

  return {
    resetPassword: resetPasswordMutation.mutate,
    isResetting: resetPasswordMutation.isPending,
    isSuccess: resetPasswordMutation.isSuccess,
    isError: resetPasswordMutation.isError,
    error: resetPasswordMutation.error,
  };
}

export function useVerifyResetToken() {
  const { toast } = useToast();

  const verifyTokenMutation = useMutation({
    mutationFn: async ({ token }: VerifyResetTokenParams) => {
      return apiRequest("POST", "/api/auth/verify-reset-token", { token });
    },
    onError: (error: any) => {
      toast({
        title: "Invalid token",
        description: error.message || "Invalid or expired reset token.",
        variant: "error",
      });
    },
  });

  return {
    verifyToken: verifyTokenMutation.mutate,
    isVerifying: verifyTokenMutation.isPending,
    isSuccess: verifyTokenMutation.isSuccess,
    isError: verifyTokenMutation.isError,
    error: verifyTokenMutation.error,
  };
}
