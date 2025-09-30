import { useState } from "react";
import PhotoGallery from "../PhotoGallery";
import mountainLake from "@assets/generated_images/Mountain_lake_sunset_landscape_e69a7a98.png";
import cityStreet from "@assets/generated_images/Black_and_white_city_16e3402f.png";
import wildflowers from "@assets/generated_images/Colorful_wildflower_meadow_macro_b87d3f6b.png";

export default function PhotoGalleryExample() {
  // todo: remove mock functionality - replace with real photo data
  const samplePhotos = [
    {
      id: "1",
      src: mountainLake,
      alt: "Mountain lake at sunset with golden reflections",
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
        }
      ]
    },
    {
      id: "2",
      src: cityStreet,
      alt: "Black and white urban street photography",
      rating: 4,
      isLiked: false,
      comments: [
        {
          id: "3",
          author: "Emma Davis",
          text: "Love the dramatic contrast in this shot!",
          timestamp: "3 hours ago"
        }
      ]
    },
    {
      id: "3",
      src: wildflowers,
      alt: "Colorful wildflowers in a meadow with morning dew",
      rating: 5,
      isLiked: true,
      comments: [
        {
          id: "4",
          author: "Alex Rodriguez",
          text: "The macro detail is incredible. Beautiful work!",
          timestamp: "4 hours ago"
        },
        {
          id: "5",
          author: "Lisa Park",
          text: "These colors are so vibrant! Nature is amazing.",
          timestamp: "2 hours ago"
        },
        {
          id: "6",
          author: "David Kim",
          text: "Perfect timing with the morning dew. Great shot!",
          timestamp: "1 hour ago"
        }
      ]
    }
  ];

  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  const handleToggleSelection = (photoId: string) => {
    console.log("Toggle selection for photo:", photoId);
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  return (
    <div className="p-6">
      <PhotoGallery 
        photos={samplePhotos} 
        selectedPhotoIds={selectedPhotoIds}
        onToggleSelection={handleToggleSelection}
      />
    </div>
  );
}