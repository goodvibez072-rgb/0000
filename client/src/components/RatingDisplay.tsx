import { Star, StarHalf } from "lucide-react";

interface RatingDisplayProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}

export function RatingDisplay({
  rating,
  maxRating = 10,
  size = "md",
  showValue = true,
  className = "",
}: RatingDisplayProps) {
  const normalizedRating = (rating / maxRating) * 5;
  const fullStars = Math.floor(normalizedRating);
  const hasHalfStar = normalizedRating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const starSize = sizeClasses[size];
  const textSize = textSizeClasses[size];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex items-center">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className={`${starSize} fill-yellow-400 text-yellow-400`} />
        ))}
        {hasHalfStar && <StarHalf className={`${starSize} fill-yellow-400 text-yellow-400`} />}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className={`${starSize} text-gray-600`} />
        ))}
      </div>
      {showValue && (
        <span className={`${textSize} font-medium text-gray-300`}>
          {rating.toFixed(1)}/{maxRating}
        </span>
      )}
    </div>
  );
}
