import { useState } from "react";
import Lightbox from "../Lightbox";
import { Button } from "@/components/ui/button";
import mountainLake from "@assets/generated_images/Mountain_lake_sunset_landscape_e69a7a98.png";

export default function LightboxExample() {
  const [isOpen, setIsOpen] = useState(false);

  const samplePhoto = {
    id: "1",
    src: mountainLake,
    alt: "Beautiful mountain lake at sunset",
    rating: 5,
    isLiked: true,
    comments: [
      {
        id: "1",
        author: "Sarah Johnson",
        text: "This is absolutely breathtaking! The lighting is perfect.",
        timestamp: "2 hours ago"
      },
      {
        id: "2", 
        author: "Mike Chen",
        text: "Amazing composition. Where was this taken?",
        timestamp: "1 hour ago"
      },
      {
        id: "3",
        author: "Emma Davis",
        text: "The reflection in the water is so serene. Love it!",
        timestamp: "30 minutes ago"
      }
    ]
  };

  const handleToggleLike = (photoId: string) => {
    console.log("Toggle like for photo:", photoId);
  };

  const handleRatingChange = (photoId: string, rating: number) => {
    console.log("Rating changed for photo:", photoId, "to:", rating);
  };

  const handleAddComment = (photoId: string, comment: string) => {
    console.log("Add comment to photo:", photoId, "comment:", comment);
  };

  return (
    <div className="p-4">
      <Button onClick={() => setIsOpen(true)} data-testid="button-open-lightbox">
        Open Lightbox Demo
      </Button>

      <Lightbox
        photo={isOpen ? samplePhoto : null}
        onClose={() => setIsOpen(false)}
        onPrevious={() => console.log("Previous photo")}
        onNext={() => console.log("Next photo")}
        onToggleLike={handleToggleLike}
        onRatingChange={handleRatingChange}
        onAddComment={handleAddComment}
      />
    </div>
  );
}