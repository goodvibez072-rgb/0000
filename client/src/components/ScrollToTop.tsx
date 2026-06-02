import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function ScrollToTop() {
  const [location] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  
  // Check if we're on signup page
  const isSignupPage = location === '/signup' || location.startsWith('/signup?');

  // Show/hide button based on scroll position
  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.pageYOffset > 500);
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  // Smooth scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      {isVisible && !isSignupPage && (
        <button
          onClick={scrollToTop}
          className="hidden md:flex fixed bottom-8 right-8 z-[60] w-12 h-12 rounded-full bg-gradient-to-br from-[#4b4bc3] to-[#1e1e76] hover:from-[#a195f9] hover:to-[#707ff5] transition-all duration-150 ease-out shadow-[0_4px_20px_rgba(75,75,195,0.4)] hover:shadow-[0_8px_30px_rgba(161,149,249,0.6)] hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-100 items-center justify-center group backdrop-blur-md border-2 border-[#707ff5]/30 hover:border-[#a195f9]/50 animate-in fade-in slide-in-from-bottom-4"
          aria-label="Scroll to top"
          data-testid="scroll-to-top-button"
        >
          <ChevronUp 
            className="w-6 h-6 text-white transition-all duration-150 group-hover:-translate-y-0.5 drop-shadow-lg" 
          />
        </button>
      )}
    </>
  );
}
