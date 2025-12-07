import { useState, useCallback } from "react";
import { Star, Heart, Trash2, X, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useAuth } from "@/contexts/AuthContext";

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

interface Photo {
  id: string;
  src: string;
  mediumSrc?: string;
  originalSrc?: string;
  alt: string;
  rating: number;
  isLiked: boolean;
  comments: Comment[];
  isSelected?: boolean;
}

interface PhotoCardProps {
  photo: Photo;
  onOpenLightbox: (photo: Photo) => void;
  onToggleLike: (photoId: string, userName?: string) => void;
  onRatingChange: (photoId: string, rating: number, userName?: string) => void;
  onToggleSelection: (photoId: string) => void;
  onDelete?: (photoId: string) => void;
  showControls?: boolean; // New prop to control if rating/like controls are shown
}

export default function PhotoCard({
  photo,
  onOpenLightbox,
  onToggleLike,
  onRatingChange,
  onToggleSelection,
  onDelete,
  showControls = true,
}: PhotoCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Try to get user from auth context, but make it optional for public galleries
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch (error) {
    // Not in auth context (public gallery), user remains null
  }

  const handleRatingClick = useCallback((rating: number) => {
    onRatingChange(photo.id, rating, user?.name);
  }, [photo.id, onRatingChange, user?.name]);

  const handleLikeClick = useCallback(() => {
    onToggleLike(photo.id, user?.name);
  }, [photo.id, onToggleLike, user?.name]);

  const handleDelete = async () => {
    if (isDeleting || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(photo.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card
      className={`overflow-hidden hover-elevate cursor-pointer group ${photo.isSelected ? "ring-2 ring-primary" : ""}`}
      data-testid={`card-photo-${photo.id}`}
    >
      <div className="relative">
        <AspectRatio ratio={2 / 3}>
          <div className="relative w-full h-full">
            {/* Skeleton Placeholder */}
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
                <div className="w-8 h-8 bg-muted-foreground/20 rounded"></div>
              </div>
            )}

            {/* Error State */}
            {imageError && (
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <div className="text-muted-foreground text-sm">
                  Fehler beim Laden
                </div>
              </div>
            )}

            {/* Actual Image */}
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              className={`w-full h-full object-cover transition-opacity duration-200 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onClick={() => onOpenLightbox(photo)}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              data-testid={`img-photo-${photo.id}`}
            />

            {/* Image name overlay on hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
              <p className="text-white text-sm font-medium px-4 text-center break-words">
                {photo.alt}
              </p>
            </div>
          </div>

          {/* Selection Button - Top Left */}
          <div className="absolute top-2 left-2">
            <Button
              variant={photo.isSelected ? "default" : "secondary"}
              size="icon"
              className="w-8 h-8"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection(photo.id);
              }}
              data-testid={`button-select-${photo.id}`}
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>

          {/* Delete Button - Top Right */}
          {onDelete && (
            <div className="absolute top-2 right-2">
              <Button
                variant="destructive"
                size="icon"
                className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isDeleting}
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    !isDeleting &&
                    confirm("Möchten Sie dieses Foto wirklich löschen?")
                  ) {
                    handleDelete();
                  }
                }}
                data-testid={`button-delete-${photo.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </AspectRatio>
      </div>

      {/* Always show controls, but hide on mobile with responsive classes */}
      <div className="p-2 hidden md:block">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleRatingClick(0)}
              className="hover:scale-110 transition-transform text-muted-foreground hover:text-red-500"
              title="Bewertung löschen"
              data-testid={`button-clear-rating-${photo.id}`}
            >
              <X className="w-3 h-3" />
            </button>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRatingClick(star)}
                className="hover:scale-110 transition-transform"
                data-testid={`button-star-${photo.id}-${star}`}
              >
                <Star
                  className={`w-3 h-3 ${
                    star <= photo.rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
            <span
              className="text-xs text-muted-foreground ml-1"
              data-testid={`text-rating-${photo.id}`}
            >
              {photo.rating}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLikeClick}
            className="p-0.5"
            data-testid={`button-like-${photo.id}`}
          >
            <Heart
              className={`w-3 h-3 ${
                photo.isLiked
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground"
              }`}
            />
          </Button>
        </div>

        <p
          className="text-xs text-muted-foreground"
          data-testid={`text-comments-${photo.id}`}
        >
          {photo.comments.length} comments
        </p>
      </div>
    </Card>
  );
}