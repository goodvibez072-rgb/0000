import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface CheckoutFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({ onSuccess, onCancel }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/shop?payment=success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "error",
        });
        setIsProcessing(false);
      } else {
        toast({
          title: "Payment Successful",
          description: "Coins have been added to your account!",
        });
        onSuccess();
      }
    } catch (err: any) {
      toast({
        title: "Payment Error",
        description: err.message || "An unexpected error occurred",
        variant: "error",
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Pay Now'
          )}
        </Button>
      </div>
    </form>
  );
}

interface StripeCheckoutProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function StripeCheckout({ clientSecret, onSuccess, onCancel }: StripeCheckoutProps) {
  if (!stripePromise) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          ⚠️ Stripe is not configured. Payment processing is unavailable.
        </p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
