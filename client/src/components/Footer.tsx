import { FaTwitter, FaDiscord, FaInstagram } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="w-full bg-gradient-to-b from-background to-[#1e1e76] border-t border-border/40 mt-16 sm:mt-20 lg:mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col items-center space-y-6 sm:space-y-8">
          <div className="flex items-center gap-3 group">
            <img 
              src="/amourscans-icon.png" 
              alt="AmourScans" 
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain will-change-transform transition-transform duration-150 ease-out group-hover:scale-110"
            />
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[#a195f9] via-[#f2a1f2] to-[#f2a1f2] bg-clip-text text-transparent">
              AmourScans
            </span>
          </div>

          <div className="text-center space-y-3 sm:space-y-4 max-w-2xl">
            <p className="text-sm sm:text-base text-muted-foreground">
              All rights reserved
            </p>
            <p className="text-sm sm:text-base lg:text-lg text-[#a195f9]/80 leading-relaxed px-4">
              Find Your Love Story - Your destination for exploring, reading, and enjoying romantic manga, manhwa and manhua.
            </p>
          </div>

          <div className="flex items-center gap-6 sm:gap-8">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
              aria-label="Twitter"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#707ff5]/20 to-[#a195f9]/20 border border-[#707ff5]/30 flex items-center justify-center will-change-transform transition-all duration-150 ease-out group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#707ff5]/40 group-hover:border-[#707ff5]/60">
                <FaTwitter className="w-5 h-5 sm:w-6 sm:h-6 text-[#a195f9] group-hover:text-[#707ff5] transition-colors duration-150" />
              </div>
            </a>

            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
              aria-label="Discord"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#a195f9]/20 to-[#f2a1f2]/20 border border-[#a195f9]/30 flex items-center justify-center will-change-transform transition-all duration-150 ease-out group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#a195f9]/40 group-hover:border-[#a195f9]/60">
                <FaDiscord className="w-5 h-5 sm:w-6 sm:h-6 text-[#f2a1f2] group-hover:text-[#a195f9] transition-colors duration-150" />
              </div>
            </a>

            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
              aria-label="Instagram"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#f2a1f2]/20 to-[#a195f9]/20 border border-[#f2a1f2]/30 flex items-center justify-center will-change-transform transition-all duration-150 ease-out group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#f2a1f2]/40 group-hover:border-[#f2a1f2]/60">
                <FaInstagram className="w-5 h-5 sm:w-6 sm:h-6 text-[#f2a1f2] group-hover:text-[#a195f9] transition-colors duration-150" />
              </div>
            </a>

          </div>

          <div className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground/60">
            <p>© {new Date().getFullYear()} AmourScans. Made with love for manga fans.</p>
            <span className="hidden sm:inline">•</span>
            <a
              href="/dmca"
              className="text-muted-foreground/60 hover:text-[#a195f9] transition-colors duration-150"
            >
              DMCA
            </a>
            <span className="hidden sm:inline">•</span>
            <a
              href="/privacy"
              className="text-muted-foreground/60 hover:text-[#a195f9] transition-colors duration-150"
            >
              Privacy Policy
            </a>
            <span className="hidden sm:inline">•</span>
            <a
              href="/terms"
              className="text-muted-foreground/60 hover:text-[#a195f9] transition-colors duration-150"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
