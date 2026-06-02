import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Mail, Scale, FileText, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

export default function DMCA() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    copyrightWork: "",
    infringingUrl: "",
    description: "",
    goodFaith: false,
    accuracy: false,
    signature: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.goodFaith || !formData.accuracy) {
      toast({
        title: "Required Declarations",
        description: "Please confirm both required declarations before submitting.",
        variant: "error"
      });
      return;
    }

    try {
      const response = await fetch('/api/dmca/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          copyrightWork: formData.copyrightWork,
          infringingUrl: formData.infringingUrl,
          description: formData.description,
          signature: formData.signature,
          goodFaithDeclaration: formData.goodFaith,
          accuracyDeclaration: formData.accuracy
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "DMCA Notice Submitted",
          description: data.message || "Your DMCA takedown notice has been received. We will review it within 48-72 hours.",
        });

        setFormData({
          fullName: "",
          email: "",
          phone: "",
          copyrightWork: "",
          infringingUrl: "",
          description: "",
          goodFaith: false,
          accuracy: false,
          signature: ""
        });
      } else {
        toast({
          title: "Submission Failed",
          description: data.message || "Failed to submit DMCA notice. Please try again.",
          variant: "error"
        });
      }
    } catch (error) {
      toast({
        title: "Submission Error",
        description: "An error occurred while submitting your notice. Please try again later.",
        variant: "error"
      });
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <SEO 
        title="DMCA Takedown Notice"
        description="Submit a DMCA takedown notice for copyright infringement. AmourScans respects intellectual property rights and responds to valid copyright claims."
        keywords="DMCA, copyright, takedown notice, copyright infringement, intellectual property"
      />
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center shadow-lg">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
              DMCA Takedown Notice
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Digital Millennium Copyright Act
            </p>
          </div>
        </div>

        <Card className="bg-card/80 backdrop-blur-md border-border/50 mb-6">
          <CardContent className="p-6 sm:p-8">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-muted-foreground">
                <p className="leading-relaxed">
                  AmourScans respects the intellectual property rights of others and expects its users to do the same. 
                  In accordance with the Digital Millennium Copyright Act (DMCA), we will respond to notices of alleged 
                  copyright infringement that comply with the DMCA and other applicable laws.
                </p>
                <p className="leading-relaxed">
                  If you believe that your copyrighted work has been copied in a way that constitutes copyright infringement 
                  and is accessible on this site, please notify our copyright agent as set forth below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <FileText className="w-5 h-5 text-primary" />
                <span>Notice Requirements</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                For your DMCA notice to be valid under the DMCA, it must include the following:
              </p>
              <ul className="list-decimal list-inside space-y-2 ml-4">
                <li>A physical or electronic signature of the copyright owner or authorized agent</li>
                <li>Identification of the copyrighted work claimed to have been infringed</li>
                <li>Identification of the material that is claimed to be infringing (URL on our site)</li>
                <li>Information reasonably sufficient to permit us to contact you (email, phone)</li>
                <li>A statement that you have a good faith belief that the use is not authorized</li>
                <li>A statement that the information in the notification is accurate</li>
                <li>A statement, under penalty of perjury, that you are authorized to act on behalf of the owner</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Send className="w-5 h-5 text-primary" />
                <span>Submit DMCA Takedown Notice</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-foreground">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fullName"
                      required
                      value={formData.fullName}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      className="bg-background/50"
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="bg-background/50"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-foreground">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="bg-background/50"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="copyrightWork" className="text-foreground">
                    Description of Copyrighted Work <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="copyrightWork"
                    required
                    value={formData.copyrightWork}
                    onChange={(e) => handleChange('copyrightWork', e.target.value)}
                    className="bg-background/50 min-h-24"
                    placeholder="Describe the copyrighted work that you own or represent..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="infringingUrl" className="text-foreground">
                    URL of Infringing Material <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="infringingUrl"
                    type="url"
                    required
                    value={formData.infringingUrl}
                    onChange={(e) => handleChange('infringingUrl', e.target.value)}
                    className="bg-background/50"
                    placeholder="https://mangaverse.com/manga/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide the specific URL(s) where the infringing content is located on our site
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-foreground">
                    Additional Information
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="bg-background/50 min-h-32"
                    placeholder="Provide any additional details that may help us process your request..."
                  />
                </div>

                <Separator />

                <div className="space-y-4 bg-muted/20 border border-border/30 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="goodFaith"
                      checked={formData.goodFaith}
                      onChange={(e) => handleChange('goodFaith', e.target.checked)}
                      className="mt-1"
                      required
                    />
                    <Label htmlFor="goodFaith" className="text-sm text-foreground leading-relaxed cursor-pointer">
                      I have a good faith belief that the use of the material in the manner complained of is not 
                      authorized by the copyright owner, its agent, or the law. <span className="text-destructive">*</span>
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="accuracy"
                      checked={formData.accuracy}
                      onChange={(e) => handleChange('accuracy', e.target.checked)}
                      className="mt-1"
                      required
                    />
                    <Label htmlFor="accuracy" className="text-sm text-foreground leading-relaxed cursor-pointer">
                      The information in this notification is accurate, and under penalty of perjury, I am authorized 
                      to act on behalf of the owner of an exclusive right that is allegedly infringed. <span className="text-destructive">*</span>
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signature" className="text-foreground">
                    Electronic Signature <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="signature"
                    required
                    value={formData.signature}
                    onChange={(e) => handleChange('signature', e.target.value)}
                    className="bg-background/50 font-signature text-lg"
                    placeholder="Type your full name as signature"
                  />
                  <p className="text-xs text-muted-foreground">
                    Type your full name to serve as your electronic signature
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit"
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit DMCA Notice
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Mail className="w-5 h-5 text-primary" />
                <span>Contact Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                Our designated Copyright Agent for notice of claims of copyright infringement can be reached as follows:
              </p>
              <div className="bg-muted/20 border border-border/30 rounded-lg p-4 space-y-2">
                <p><strong className="text-foreground">DMCA Agent:</strong> AmourScans Legal Team</p>
                <p><strong className="text-foreground">Email:</strong> dmca@mangaverse.com</p>
                <p><strong className="text-foreground">Response Time:</strong> 48-72 hours</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mt-4">
                <p className="text-sm text-foreground">
                  <strong>Important:</strong> Filing a false DMCA notice may result in legal consequences. Please ensure 
                  all information provided is accurate and that you have the legal authority to file this notice.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="text-xl">Counter-Notification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p className="leading-relaxed">
                If you believe that your content was wrongly removed due to a DMCA takedown notice, you may file a 
                counter-notification. The counter-notification must include:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your physical or electronic signature</li>
                <li>Identification of the material that was removed</li>
                <li>A statement under penalty of perjury that you have a good faith belief the material was removed by mistake</li>
                <li>Your name, address, and phone number</li>
                <li>A statement consenting to jurisdiction of the Federal District Court</li>
              </ul>
              <p className="leading-relaxed mt-4">
                Please send counter-notifications to: <strong className="text-foreground">dmca-counter@mangaverse.com</strong>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
