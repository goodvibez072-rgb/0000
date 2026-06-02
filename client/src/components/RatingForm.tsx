import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRatings } from "@/hooks/useRatings";
import { useAuth } from "@/hooks/useAuth";

interface RatingFormProps {
  seriesId: string;
  existingRating?: number | null;
  existingReview?: string | null;
  onSuccess?: () => void;
}

export function RatingForm({ seriesId, existingRating, existingReview, onSuccess }: RatingFormProps) {
  const { user } = useAuth();
  const { submitRating, isSubmittingRating, deleteRating, isDeletingRating } = useRatings(seriesId);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(existingRating || 0);
  const [review, setReview] = useState<string>(existingReview || "");

  useEffect(() => {
    setSelectedRating(existingRating || 0);
    setReview(existingReview || "");
  }, [existingRating, existingReview]);

  if (!user) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
        <p className="text-gray-400">Please log in to rate this series</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRating === 0) return;

    submitRating(
      { rating: selectedRating, review: review.trim() || undefined },
      {
        onSuccess: () => {
          onSuccess?.();
        },
      }
    );
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete your rating?")) {
      deleteRating(undefined, {
        onSuccess: () => {
          setSelectedRating(0);
          setReview("");
          onSuccess?.();
        },
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Your Rating</label>
        <div className="flex items-center gap-1">
          {Array.from({ length: 10 }).map((_, index) => {
            const ratingValue = index + 1;
            const isActive = ratingValue <= (hoveredRating ?? selectedRating);

            return (
              <button
                key={ratingValue}
                type="button"
                className="transition-transform hover:scale-110"
                onMouseEnter={() => setHoveredRating(ratingValue)}
                onMouseLeave={() => setHoveredRating(null)}
                onClick={() => setSelectedRating(ratingValue)}
              >
                <Star
                  className={`w-6 h-6 ${
                    isActive ? "fill-yellow-400 text-yellow-400" : "text-gray-600"
                  }`}
                />
              </button>
            );
          })}
          <span className="ml-2 text-lg font-medium text-gray-300">
            {selectedRating > 0 ? `${selectedRating}/10` : "Not rated"}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="review" className="block text-sm font-medium text-gray-300 mb-2">
          Review (Optional)
        </label>
        <Textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your thoughts about this series..."
          className="min-h-[120px] bg-gray-900 border-gray-700 text-gray-100 placeholder:text-gray-500"
          maxLength={1000}
        />
        <p className="text-xs text-gray-500 mt-1">{review.length}/1000 characters</p>
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={selectedRating === 0 || isSubmittingRating}
          className="flex-1"
        >
          {isSubmittingRating ? "Submitting..." : existingRating ? "Update Rating" : "Submit Rating"}
        </Button>
        {existingRating && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeletingRating}
          >
            {isDeletingRating ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
    </form>
  );
}
