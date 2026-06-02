import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Eye, Monitor, Tablet, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface AdPreviewProps {
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl: string;
  type: string;
  page: string;
  location: string;
  className?: string;
}

export function AdPreview({
  title,
  description,
  imageUrl,
  linkUrl,
  type,
  page,
  location,
  className
}: AdPreviewProps) {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  // Device viewport widths
  const deviceWidths = {
    mobile: 'max-w-[375px]',
    tablet: 'max-w-[768px]',
    desktop: 'max-w-full'
  };
  
  // Render different ad types
  const renderAdPreview = () => {
    switch (type) {
      case 'banner':
        return (
          <div className="w-full bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-purple-900/20 rounded-lg overflow-hidden border-2 border-purple-500/30">
            {imageUrl ? (
              <div className="relative group cursor-pointer">
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-32 md:h-40 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-3 left-3 right-3">
                    <h4 className="font-bold text-white text-sm md:text-base truncate">{title || 'Ad Title'}</h4>
                    {description && (
                      <p className="text-xs text-white/80 truncate">{description}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 md:h-40 flex items-center justify-center bg-muted/50">
                <p className="text-muted-foreground text-sm">Banner Ad Preview</p>
              </div>
            )}
          </div>
        );

      case 'sidebar':
        return (
          <div className="w-full max-w-xs bg-gradient-to-br from-purple-900/10 to-pink-900/10 rounded-lg overflow-hidden border border-purple-500/30">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-64 object-cover"
              />
            ) : (
              <div className="h-64 flex items-center justify-center bg-muted/50">
                <p className="text-muted-foreground text-sm">Sidebar Ad</p>
              </div>
            )}
            <div className="p-3 space-y-1">
              <h4 className="font-semibold text-sm text-foreground truncate">{title || 'Ad Title'}</h4>
              {description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
              )}
              <div className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                <ExternalLink className="w-3 h-3" />
                <span>Learn More</span>
              </div>
            </div>
          </div>
        );

      case 'popup':
        return (
          <div className="relative max-w-md mx-auto">
            <div className="bg-gradient-to-br from-purple-950 to-pink-950 rounded-xl overflow-hidden border-2 border-purple-500/50 shadow-2xl shadow-purple-500/20">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="h-48 flex items-center justify-center bg-muted/50">
                  <p className="text-muted-foreground text-sm">Popup Ad</p>
                </div>
              )}
              <div className="p-4 space-y-2">
                <h3 className="font-bold text-lg text-white">{title || 'Ad Title'}</h3>
                {description && (
                  <p className="text-sm text-gray-300">{description}</p>
                )}
                <button className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium transition-all transform hover:scale-105">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        );

      case 'inline':
        return (
          <div className="w-full bg-gradient-to-r from-purple-900/5 via-transparent to-pink-900/5 rounded-lg overflow-hidden border border-purple-500/20">
            <div className="flex flex-col md:flex-row gap-3 p-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title}
                  className="w-full md:w-32 h-24 md:h-20 object-cover rounded"
                />
              ) : (
                <div className="w-full md:w-32 h-24 md:h-20 flex items-center justify-center bg-muted/50 rounded">
                  <p className="text-xs text-muted-foreground">Inline</p>
                </div>
              )}
              <div className="flex-1 flex flex-col justify-center">
                <Badge className="w-fit mb-1 bg-purple-600/20 text-purple-300 border-purple-500/30">
                  Sponsored
                </Badge>
                <h4 className="font-semibold text-sm text-foreground">{title || 'Ad Title'}</h4>
                {description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="w-full h-32 bg-muted/50 rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Select an ad type to preview</p>
          </div>
        );
    }
  };

  return (
    <Card className={cn("bg-card/50 backdrop-blur border-purple-500/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-400" />
            <CardTitle className="text-base">Live Preview</CardTitle>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs border-purple-500/30">
              {type || 'No Type'}
            </Badge>
            <Badge variant="outline" className="text-xs border-pink-500/30">
              {page || 'No Page'} / {location || 'No Location'}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground mr-2">Device:</span>
          <Button
            variant={deviceType === 'mobile' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDeviceType('mobile')}
            className={cn(
              "h-8 gap-1.5",
              deviceType === 'mobile' && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="text-xs">Mobile</span>
          </Button>
          <Button
            variant={deviceType === 'tablet' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDeviceType('tablet')}
            className={cn(
              "h-8 gap-1.5",
              deviceType === 'tablet' && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="text-xs">Tablet</span>
          </Button>
          <Button
            variant={deviceType === 'desktop' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDeviceType('desktop')}
            className={cn(
              "h-8 gap-1.5",
              deviceType === 'desktop' && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="text-xs">Desktop</span>
          </Button>
          <Badge variant="secondary" className="ml-auto text-xs">
            {deviceType === 'mobile' && '375px'}
            {deviceType === 'tablet' && '768px'}
            {deviceType === 'desktop' && 'Full Width'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center">
          <div className={cn(
            "w-full transition-all duration-300 ease-in-out",
            deviceWidths[deviceType]
          )}>
            <div className="p-4 bg-background/50 rounded-lg border border-border">
              <div className={cn(
                "transition-all duration-300",
                deviceType === 'mobile' && "scale-95",
                deviceType === 'tablet' && "scale-98"
              )}>
                {renderAdPreview()}
              </div>
            </div>
          </div>
        </div>
        
        {!imageUrl && (
          <p className="text-xs text-muted-foreground text-center">
            Upload an image to see the full preview
          </p>
        )}
        
        {linkUrl && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ExternalLink className="w-3 h-3" />
            <span className="truncate">Links to: {linkUrl}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
