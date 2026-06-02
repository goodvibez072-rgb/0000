import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <SEO 
        title="Terms of Service"
        description="AmourScans Terms of Service - Read our terms and conditions for using the platform."
        keywords="terms of service, terms and conditions, user agreement, legal"
      />
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
              Terms of Service
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: October 24, 2025
            </p>
          </div>
        </div>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8 mb-6">
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-muted-foreground leading-relaxed">
              Welcome to AmourScans. By accessing or using our website and services, you agree to be bound by these Terms of Service. Please read them carefully. If you do not agree with any part of these terms, please do not use our platform.
            </p>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span>1. Acceptance of Terms</span>
          </h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-4">
            <p>By creating an account or using AmourScans, you confirm that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are at least 13 years of age</li>
              <li>You have the legal capacity to enter into binding agreements</li>
              <li>You will comply with all applicable laws and regulations</li>
              <li>You will not use the service for any illegal purposes</li>
            </ul>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">2. User Accounts</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-4">
            <p><strong>Account Creation:</strong> You must provide accurate and complete information when creating your account.</p>
            <p><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
            <p><strong>Account Termination:</strong> We reserve the right to suspend or terminate accounts that violate these terms.</p>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">3. User Conduct</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-4">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Upload, post, or transmit any content that infringes intellectual property rights</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Use automated systems to access the service without permission</li>
              <li>Attempt to gain unauthorized access to any part of the service</li>
              <li>Distribute malware, viruses, or other harmful code</li>
              <li>Engage in any activity that disrupts or interferes with the service</li>
            </ul>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">4. Content and Intellectual Property</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-4">
            <p><strong>Our Content:</strong> All content on AmourScans, including text, graphics, logos, and software, is owned by AmourScans or its content suppliers and is protected by copyright laws.</p>
            <p><strong>User Content:</strong> You retain ownership of content you submit, but grant us a worldwide, non-exclusive license to use, display, and distribute it on our platform.</p>
            <p><strong>Copyright Compliance:</strong> We respect intellectual property rights and respond to valid DMCA takedown notices.</p>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">5. Subscriptions and Payments</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-4">
            <p><strong>Billing:</strong> Subscriptions are billed on a recurring basis until cancelled.</p>
            <p><strong>Refunds:</strong> Refund policies are outlined in our refund policy section.</p>
            <p><strong>Currency:</strong> Virtual currency (coins) purchased on the platform is non-refundable except as required by law.</p>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">6. Limitation of Liability</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground space-y-4">
            <p>AmourScans is provided "as is" without warranties of any kind. We are not liable for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Loss of data or content</li>
              <li>Service interruptions or downtime</li>
              <li>Errors or inaccuracies in content</li>
              <li>Unauthorized access to your account</li>
              <li>Any indirect, consequential, or punitive damages</li>
            </ul>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">7. Changes to Terms</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground">
            <p>We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 p-6 sm:p-8">
          <h2 className="text-2xl font-bold mb-4">8. Contact Information</h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground">
            <p>If you have questions about these Terms of Service, please contact us through our support channels.</p>
          </div>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
