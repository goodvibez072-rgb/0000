import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Mail, Database, Cookie, Eye, Lock, UserCheck } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <SEO 
        title="Privacy Policy"
        description="AmourScans Privacy Policy - Learn how we collect, use, and protect your personal information. Your privacy is our priority."
        keywords="privacy policy, data protection, user privacy, personal information"
      />
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 mb-6">
          <CardContent className="p-6 sm:p-8">
            <p className="text-muted-foreground leading-relaxed">
              At AmourScans, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, 
              and safeguard your information when you visit our website and use our services. Please read this privacy 
              policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Database className="w-5 h-5 text-primary" />
                <span>Information We Collect</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Personal Data</h4>
                <p className="leading-relaxed">
                  When you register for an account, we may collect personally identifiable information such as:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Username and display name</li>
                  <li>Email address</li>
                  <li>Profile picture (if uploaded)</li>
                  <li>Country (optional)</li>
                </ul>
              </div>
              
              <Separator className="my-4" />
              
              <div>
                <h4 className="font-semibold text-foreground mb-2">Usage Data</h4>
                <p className="leading-relaxed">
                  We automatically collect certain information when you visit, use, or navigate the site. This includes:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Reading history and progress</li>
                  <li>Bookmarked and favorited manga</li>
                  <li>Comments and ratings</li>
                  <li>Device and browser information</li>
                  <li>IP address and location data</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Eye className="w-5 h-5 text-primary" />
                <span>How We Use Your Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                We use the information we collect or receive:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>To provide, operate, and maintain our website and services</li>
                <li>To improve, personalize, and expand our services</li>
                <li>To understand and analyze how you use our website</li>
                <li>To develop new features and functionality</li>
                <li>To communicate with you, including for customer service and updates</li>
                <li>To send you notifications about new chapters and series</li>
                <li>To find and prevent fraud and security issues</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Cookie className="w-5 h-5 text-primary" />
                <span>Cookies and Tracking Technologies</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our service and store certain information. 
                Cookies are files with small amounts of data which may include an anonymous unique identifier.
              </p>
              <div className="bg-muted/20 border border-border/30 rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-foreground mb-2">Types of Cookies We Use:</h4>
                <ul className="space-y-2">
                  <li><strong className="text-foreground">Essential Cookies:</strong> Required for the website to function properly</li>
                  <li><strong className="text-foreground">Preference Cookies:</strong> Remember your settings and preferences</li>
                  <li><strong className="text-foreground">Analytics Cookies:</strong> Help us understand how visitors interact with our website</li>
                </ul>
              </div>
              <p className="leading-relaxed mt-4">
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, 
                if you do not accept cookies, you may not be able to use some portions of our service.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Lock className="w-5 h-5 text-primary" />
                <span>Data Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information. 
                However, please note that no method of transmission over the Internet or electronic storage is 100% secure. 
                While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee 
                its absolute security.
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                <p className="text-foreground">
                  <strong>Security Measures:</strong> We use encryption, secure servers, and regular security audits to protect your data.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <UserCheck className="w-5 h-5 text-primary" />
                <span>Your Privacy Rights</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                Depending on your location, you may have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-foreground">Access:</strong> Request a copy of your personal data</li>
                <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate data</li>
                <li><strong className="text-foreground">Deletion:</strong> Request deletion of your personal data</li>
                <li><strong className="text-foreground">Restriction:</strong> Request restriction of processing your data</li>
                <li><strong className="text-foreground">Data Portability:</strong> Request transfer of your data</li>
                <li><strong className="text-foreground">Objection:</strong> Object to our processing of your data</li>
              </ul>
              <p className="leading-relaxed mt-4">
                To exercise these rights, please contact us using the information provided below.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Mail className="w-5 h-5 text-primary" />
                <span>Contact Us</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-muted/20 border border-border/30 rounded-lg p-4 space-y-2">
                <p><strong className="text-foreground">Email:</strong> privacy@mangaverse.com</p>
                <p><strong className="text-foreground">Response Time:</strong> We aim to respond within 48 hours</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                This privacy policy was last updated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. 
                We reserve the right to update or change our Privacy Policy at any time. We will notify you of any changes by 
                posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
