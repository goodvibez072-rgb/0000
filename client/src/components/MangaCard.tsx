import { Star, Clock, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { memo } from "react";

interface MangaCardProps {
  id: number;
  title: string;
  image: string;
  rating: number;
  status: "Ongoing" | "Completed";
  latestChapter: string;
  views: string;
  genres: string[];
  updatedAt: string;
  onClick?: () => void;
}

const MangaCard = memo(function MangaCard({
  title,
  image,
  rating,
  status,
  latestChapter,
  views,
  genres,
  updatedAt,
  onClick
}: MangaCardProps) {
  return (
    <div 
      className="group bg-card/80 backdrop-blur-sm rounded-xl overflow-hidden border border-card-border/50 relative touch-manipulation will-change-transform shadow-lg hover:shadow-2xl"
      style={{
        transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'translateZ(0)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-10px) scale(1.02) translateZ(0)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(112, 127, 245, 0.3), 0 8px 16px rgba(161, 149, 249, 0.2), 0 4px 8px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateZ(0)';
        e.currentTarget.style.boxShadow = '';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transition = 'transform 100ms cubic-bezier(0.4, 0, 0.2, 1)';
        e.currentTarget.style.transform = 'scale(0.98) translateZ(0)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transition = 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)';
        e.currentTarget.style.transform = 'translateY(-10px) scale(1.02) translateZ(0)';
      }}
      data-testid={`manga-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Image Container */}
      <div className="group/cover relative aspect-[3/4] overflow-hidden cursor-pointer" onClick={onClick}>
        {/* Platinum Shine Effect - Limited to Cover Area */}
        <div className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover/cover:opacity-100 transition-opacity duration-150 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] transition-none group-hover/cover:translate-x-[200%] group-hover/cover:transition-transform group-hover/cover:duration-1000 group-hover/cover:ease-out"></div>
        </div>
        <img
          src={image}
          alt={title}
          width="300"
          height="450"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover will-change-transform"
          style={{
            transition: 'transform 140ms cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateZ(0)'
          }}
          onMouseEnter={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.transform = 'scale(1.1) translateZ(0)';
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.transform = 'translateZ(0)';
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== '/api/covers/placeholder') {
              target.src = '/api/covers/placeholder';
            }
          }}
        />
        
        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/cover:opacity-100 transition-opacity duration-150" />
        
        {/* Status Badge */}
        <Badge 
          variant={status === "Ongoing" ? "default" : "secondary"}
          className={`absolute top-2 left-2 z-20 text-white text-xs font-medium px-2 py-0.5 shadow-md rounded-md ${
            status === "Ongoing" 
              ? 'bg-gradient-to-r from-orange-500 to-red-500' 
              : 'bg-gradient-to-r from-slate-600 to-slate-700'
          }`}
        >
          {status}
        </Badge>
        
        {/* Rating */}
        <div className="absolute top-2 right-2 z-20 flex items-center space-x-1 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-md px-2 py-0.5 shadow-md">
          <Star className="w-3 h-3 fill-white text-white" />
          <span className="text-white text-xs font-medium">{rating}</span>
        </div>

        {/* Hover Content */}
        <div className="absolute bottom-2 left-2 right-2 z-20 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-150">
          <Button size="sm" className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg rounded-md" data-testid="read-now">
            Read Now
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-card-foreground line-clamp-2 group-hover:text-primary transition-colors duration-150">
          {title}
        </h3>
        
        {/* Genres */}
        <div className="flex flex-wrap gap-1.5">
          {genres.slice(0, 2).map((genre, index) => {
            const variants = ['info', 'success', 'warning', 'pink', 'default'] as const;
            const variant = variants[index % variants.length];
            return (
              <Badge key={genre} variant={variant} className="text-xs">
                {genre}
              </Badge>
            );
          })}
          {genres.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{genres.length - 2}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{latestChapter}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Eye className="w-3 h-3" />
            <span>{views}</span>
          </div>
        </div>

        {/* Updated Time */}
        <p className="text-xs text-muted-foreground">
          Updated {updatedAt}
        </p>
      </div>
    </div>
  );
});

export default MangaCard;