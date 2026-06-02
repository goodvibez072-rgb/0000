import { formatDistanceToNow } from "date-fns";
import { RatingDisplay } from "./RatingDisplay";
import { useRatings } from "@/hooks/useRatings";
import { Loader2 } from "lucide-react";

interface ReviewsListProps {
  seriesId: string;
}

export function ReviewsList({ seriesId }: ReviewsListProps) {
  const { ratings, isLoadingRatings } = useRatings(seriesId);

  if (isLoadingRatings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const reviewsWithText = ratings.filter((r) => r.review && r.review.trim().length > 0);

  if (reviewsWithText.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No reviews yet. Be the first to review this series!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviewsWithText.map((rating) => (
        <div
          key={rating.id}
          className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                {rating.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-200">{rating.username}</p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <RatingDisplay rating={rating.rating} size="sm" />
          </div>
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{rating.review}</p>
        </div>
      ))}
    </div>
  );
}
