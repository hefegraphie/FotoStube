import PhotoCard from "../PhotoCard";
import mountainLake from "@assets/generated_images/Mountain_lake_sunset_landscape_e69a7a98.png";

export default function PhotoCardExample() {
  const samplePhoto = {
    id: "1",
    src: mountainLake,
    alt: "Beautiful mountain lake at sunset",
    rating: 5,
    isLiked: true,
    comments: 3
  };

  const handleOpenLightbox = (photo: any) => {
    console.log("Open lightbox for:", photo.alt);
  };

  const handleToggleLike = (photoId: string) => {
    console.log("Toggle like for photo:", photoId);
  };

  const handleRatingChange = (photoId: string, rating: number) => {
    console.log("Rating changed for photo:", photoId, "to:", rating);
  };

  const handleToggleSelection = (photoId: string) => {
    console.log("Toggle selection for photo:", photoId);
  };

  return (
    <div className="p-4 max-w-sm">
      <PhotoCard
        photo={samplePhoto}
        onOpenLightbox={handleOpenLightbox}
        onToggleLike={handleToggleLike}
        onRatingChange={handleRatingChange}
        onToggleSelection={handleToggleSelection}
      />
    </div>
  );
}