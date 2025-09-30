import { useState } from "react";
import SelectionPanel from "../SelectionPanel";
import mountainLake from "@assets/generated_images/Mountain_lake_sunset_landscape_e69a7a98.png";
import cityStreet from "@assets/generated_images/Black_and_white_city_16e3402f.png";
import wildflowers from "@assets/generated_images/Colorful_wildflower_meadow_macro_b87d3f6b.png";

export default function SelectionPanelExample() {
  const [selectedPhotos, setSelectedPhotos] = useState([
    {
      id: "1",
      src: mountainLake,
      alt: "Mountain lake at sunset",
      rating: 5
    },
    {
      id: "2", 
      src: cityStreet,
      alt: "Black and white city street",
      rating: 4
    },
    {
      id: "3",
      src: wildflowers,
      alt: "Colorful wildflowers",
      rating: 5
    }
  ]);

  const handleClearSelection = () => {
    console.log("Clear all selections");
    setSelectedPhotos([]);
  };

  const handleRatingChange = (rating: number) => {
    console.log("Batch rating change:", rating);
    setSelectedPhotos(prev => prev.map(photo => ({ ...photo, rating })));
  };

  const handleRemoveFromSelection = (photoId: string) => {
    console.log("Remove from selection:", photoId);
    setSelectedPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  return (
    <div className="h-screen bg-background">
      <SelectionPanel
        selectedPhotos={selectedPhotos}
        onClearSelection={handleClearSelection}
        onRatingChange={handleRatingChange}
        onRemoveFromSelection={handleRemoveFromSelection}
      />
    </div>
  );
}