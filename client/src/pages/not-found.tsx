import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <SEO 
        title="404 Error - Page Not Found on AmourScans Manga Reader"
        description="The page you're looking for could not be found. Return to AmourScans home page to continue reading your favorite manga and manhwa series online for free."
        keywords="404, page not found, error page"
      />
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
