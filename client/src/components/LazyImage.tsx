import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallback?: string;
  placeholderClassName?: string;
  blurDataUrl?: string; // Base64 blur placeholder for better UX
  webpSrc?: string; // Optional WebP source for modern browsers
}

export function LazyImage({
  src,
  alt,
  fallback = "/placeholder-manga.png",
  className,
  placeholderClassName,
  blurDataUrl,
  webpSrc,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px",
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const imageSrc = hasError ? fallback : src;
  const shouldLoad = isInView || isLoaded;

  // Determine which source to use (WebP for modern browsers, fallback to original)
  const finalSrc = shouldLoad ? imageSrc : blurDataUrl || undefined;

  return (
    <div className="relative overflow-hidden">
      {/* Blur placeholder for smooth loading experience */}
      {!isLoaded && blurDataUrl && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 w-full h-full object-cover blur-2xl scale-110",
            placeholderClassName
          )}
        />
      )}
      
      {/* Animated placeholder if no blur data */}
      {!isLoaded && !blurDataUrl && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-gray-800/50 to-gray-900/50 animate-pulse",
            placeholderClassName
          )}
        />
      )}
      
      {/* Modern browsers: Use picture element for WebP support */}
      {webpSrc && shouldLoad ? (
        <picture>
          <source srcSet={webpSrc} type="image/webp" />
          <source srcSet={imageSrc} type="image/jpeg" />
          <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            className={cn(
              "transition-opacity duration-500 ease-in-out",
              isLoaded ? "opacity-100" : "opacity-0",
              className
            )}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            loading="lazy"
            {...props}
          />
        </picture>
      ) : (
        <img
          ref={imgRef}
          src={finalSrc}
          alt={alt}
          className={cn(
            "transition-opacity duration-500 ease-in-out",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          loading="lazy"
          {...props}
        />
      )}
    </div>
  );
}
