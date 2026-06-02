import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import PopularToday from "@/components/PopularToday";
import Pinned from "@/components/Pinned";
import LatestUpdates from "@/components/LatestUpdates";
import Trending from "@/components/Trending";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { BannerAd } from "@/components/AdDisplay";

export default function Home() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden optimized-scroll">
      <SEO 
        description="Explore thousands of manga and manhwa series with ratings, latest updates, and trending recommendations. Read your favorite manga online at AmourScans."
        keywords="manga, manhwa, webtoon, read manga online, manga reader, latest manga updates, trending manga"
      />
      <Navigation />
      <HeroBanner />
      
      <main id="main-content" role="main" aria-label="Main content">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          <div className="space-y-8 card-grid">
            <BannerAd page="homepage" location="top_banner" className="mb-6" />
            <Pinned />
            <PopularToday />
            <LatestUpdates />
            <Trending />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}