import { useEffect } from "react";
import { useLocation } from "wouter";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  type?: "website" | "article" | "book";
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  canonicalUrl?: string;
}

export function SEO({
  title,
  description,
  keywords,
  image,
  type = "website",
  author,
  publishedTime,
  modifiedTime,
  canonicalUrl
}: SEOProps) {
  const [location] = useLocation();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const currentUrl = canonicalUrl || `${baseUrl}${location}`;
  
  const fullTitle = title 
    ? `${title} | AmourScans`
    : "AmourScans - Find Your Love Story";
  
  const defaultDescription = "Find your love story - explore romantic manga, manhwa, and manhua with beautiful artwork and heartwarming stories. Your destination for romance comics.";
  const metaDescription = description || defaultDescription;
  
  const defaultKeywords = "manga, manhwa, manhua, webtoon, comics, read manga online, manga reader, manhwa reader";
  const metaKeywords = keywords ? `${defaultKeywords}, ${keywords}` : defaultKeywords;
  
  const ogImage = image || `${baseUrl}/attached_assets/Featured_manga_hero_cover_71879d12.png`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;
    
    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Standard meta tags
    updateMetaTag('description', metaDescription);
    updateMetaTag('keywords', metaKeywords);
    if (author) updateMetaTag('author', author);
    
    // Open Graph tags
    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', metaDescription, true);
    updateMetaTag('og:url', currentUrl, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', 'AmourScans', true);
    
    if (publishedTime) updateMetaTag('article:published_time', publishedTime, true);
    if (modifiedTime) updateMetaTag('article:modified_time', modifiedTime, true);
    if (author) updateMetaTag('article:author', author, true);
    
    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', metaDescription);
    updateMetaTag('twitter:image', ogImage);
    updateMetaTag('twitter:url', currentUrl);
    
    // Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', currentUrl);
    
  }, [fullTitle, metaDescription, metaKeywords, ogImage, currentUrl, type, author, publishedTime, modifiedTime]);

  return null;
}

interface StructuredDataProps {
  type: "Series" | "Book" | "Organization" | "WebSite" | "BreadcrumbList";
  data: Record<string, any>;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  useEffect(() => {
    const scriptId = `structured-data-${type.toLowerCase()}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (!script) {
      script = document.createElement('script') as HTMLScriptElement;
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    
    const structuredData = {
      "@context": "https://schema.org",
      "@type": type === "Series" ? "Book" : type,
      ...data
    };
    
    script.textContent = JSON.stringify(structuredData);
    
    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [type, data]);

  return null;
}
