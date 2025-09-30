import { useState, useEffect, useMemo } from "react";
import PhotoCard from "./PhotoCard";
import Lightbox from "./Lightbox";
import { Button } from "@/components/ui/button";
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

interface FilterState {
  showOnlyLiked: boolean;
  showOnlyRated: boolean;
  minStars: number;
  maxStars: number;
}

interface PhotoGalleryProps {
  photos: Photo[];
  selectedPhotoIds: Set<string>;
  onToggleSelection: (photoId: string) => void;
  onPhotosChange?: () => void;
  isPublicView?: boolean;
  authContext?: { user: any } | null;
  filters?: FilterState;
  galleryContext?: {
    currentGallery: string;
    parentGallery?: string;
    grandParentGallery?: string;
  };
  onRatingChange?: (photoId: string, rating: number) => void;
  onLikeToggle?: (photoId: string, isLiked: boolean) => void;
}

export default function PhotoGallery({
  photos: initialPhotos,
  selectedPhotoIds,
  onToggleSelection,
  onPhotosChange,
  isPublicView = false,
  authContext = null,
  filters,
  galleryContext,
  onRatingChange: externalRatingChange,
  onLikeToggle: externalLikeToggle,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState(initialPhotos);

  const user = authContext?.user || null;

  // Sync internal state when photos prop changes
  useEffect(() => {
    setGalleryPhotos(initialPhotos);
  }, [initialPhotos]);

  // Handle URL hash changes for lightbox navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#lightbox-")) {
        const photoId = hash.replace("#lightbox-", "");
        const photo = galleryPhotos.find((p) => p.id === photoId);
        if (photo && (!selectedPhoto || selectedPhoto.id !== photoId)) {
          // Transformation für Lightbox-Bild: immer Medium/originalSrc im src
          const transformedPhoto = {
            ...photo,
            src: photo.src,
            mediumSrc: photo.mediumSrc,
            originalSrc: photo.originalSrc,
            rating: photo.rating || 0,
            isLiked: photo.isLiked || false,
            comments: photo.comments || [],
          };
          setSelectedPhoto(transformedPhoto);
        }
      } else if (selectedPhoto) {
        setSelectedPhoto(null);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [galleryPhotos, selectedPhoto]);

  // Filter photos based on filter state
  const filteredPhotos = useMemo(() => {
    if (!filters) return galleryPhotos;

    return galleryPhotos.filter((photo) => {
      if (filters.showOnlyLiked && !photo.isLiked) return false;
      if (filters.showOnlyRated && photo.rating === 0) return false;
      if (photo.rating < filters.minStars || photo.rating > filters.maxStars)
        return false;
      return true;
    });
  }, [galleryPhotos, filters]);

  const handleOpenLightbox = (photo: Photo) => {
    const transformedPhoto = {
      ...photo,
      src: photo.src,
      mediumSrc: photo.mediumSrc,
      originalSrc: photo.originalSrc,
      rating: photo.rating || 0,
      isLiked: photo.isLiked || false,
      comments: photo.comments || [],
    };
    setSelectedPhoto(transformedPhoto);
    window.location.hash = `#lightbox-${photo.id}`; // Update URL hash
  };

  const handleCloseLightbox = () => {
    setSelectedPhoto(null);
    window.location.hash = ""; // Remove hash from URL
  };

  const handlePrevious = () => {
    if (!selectedPhoto) return;
    const currentIndex = filteredPhotos.findIndex(
      (p) => p.id === selectedPhoto.id,
    );
    const previousIndex =
      currentIndex > 0 ? currentIndex - 1 : filteredPhotos.length - 1;
    const photo = filteredPhotos[previousIndex];
    const transformedPhoto = {
      ...photo,
      src: photo.src,
      mediumSrc: photo.mediumSrc,
      originalSrc: photo.originalSrc,
      rating: photo.rating || 0,
      isLiked: photo.isLiked || false,
      comments: photo.comments || [],
    };
    setSelectedPhoto(transformedPhoto);
    window.location.hash = `#lightbox-${photo.id}`;
  };

  const handleNext = () => {
    if (!selectedPhoto) return;
    const currentIndex = filteredPhotos.findIndex(
      (p) => p.id === selectedPhoto.id,
    );
    const nextIndex =
      currentIndex < filteredPhotos.length - 1 ? currentIndex + 1 : 0;
    const photo = filteredPhotos[nextIndex];
    const transformedPhoto = {
      ...photo,
      src: photo.src,
      mediumSrc: photo.mediumSrc,
      originalSrc: photo.originalSrc,
      rating: photo.rating || 0,
      isLiked: photo.isLiked || false,
      comments: photo.comments || [],
    };
    setSelectedPhoto(transformedPhoto);
    window.location.hash = `#lightbox-${photo.id}`;
  };

  const handleToggleLike = async (photoId: string) => {
    const currentPhoto = galleryPhotos.find((p) => p.id === photoId);
    if (!currentPhoto) return;

    const newLikeState = !currentPhoto.isLiked;

    if (externalLikeToggle) {
      externalLikeToggle(photoId, newLikeState);
      return;
    }

    try {
      const response = await fetch(`/api/photos/${photoId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isLiked: newLikeState,
          userName: user?.name,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const serverLikeStatus = result.isLiked;

        setGalleryPhotos((prev) =>
          prev.map((photo) =>
            photo.id === photoId
              ? { ...photo, isLiked: serverLikeStatus }
              : photo,
          ),
        );

        if (selectedPhoto && selectedPhoto.id === photoId) {
          setSelectedPhoto((prev) =>
            prev ? { ...prev, isLiked: serverLikeStatus } : null,
          );
        }
        onPhotosChange?.();
      } else {
        const errorData = await response.json();
        alert("Fehler beim Speichern des Likes");
      }
    } catch (error) {
      alert("Fehler beim Speichern des Likes");
    }
  };

  const handleRatingChange = async (photoId: string, rating: number) => {
    if (externalRatingChange) {
      externalRatingChange(photoId, rating);
      return;
    }
    try {
      const response = await fetch(`/api/photos/${photoId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          userName: user?.name,
        }),
      });

      if (response.ok) {
        setGalleryPhotos((prev) =>
          prev.map((photo) =>
            photo.id === photoId ? { ...photo, rating } : photo,
          ),
        );

        if (selectedPhoto && selectedPhoto.id === photoId) {
          setSelectedPhoto((prev) => (prev ? { ...prev, rating } : null));
        }

        onPhotosChange?.();
      }
    } catch (error) {}
  };

  const handleAddComment = async (
    photoId: string,
    commentText: string,
    commenterName: string = "Anonym",
  ) => {
    try {
      const response = await fetch(`/api/photos/${photoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commenterName, text: commentText }),
      });

      if (response.ok) {
        const result = await response.json();

        const newComment = {
          id: result.commentId,
          author: commenterName,
          text: commentText,
          timestamp: "gerade eben",
        };

        setGalleryPhotos((prev) =>
          prev.map((photo) =>
            photo.id === photoId
              ? { ...photo, comments: [...photo.comments, newComment] }
              : photo,
          ),
        );

        if (selectedPhoto && selectedPhoto.id === photoId) {
          setSelectedPhoto((prev) =>
            prev
              ? {
                  ...prev,
                  comments: [...prev.comments, newComment],
                }
              : null,
          );
        }
        onPhotosChange?.();
      } else {
        alert("Fehler beim Hinzufügen des Kommentars");
      }
    } catch (error) {
      alert("Fehler beim Hinzufügen des Kommentars");
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setGalleryPhotos((prev) =>
          prev.filter((photo) => photo.id !== photoId),
        );

        if (selectedPhoto && selectedPhoto.id === photoId) {
          setSelectedPhoto(null);
          window.location.hash = "";
        }
        onPhotosChange?.();
      } else {
        alert("Fehler beim Löschen");
      }
    } catch (error) {
      alert("Fehler beim Löschen des Fotos");
    }
  };

  const handleBatchRating = async (rating: number) => {
    const photoIds = Array.from(selectedPhotoIds);
    if (photoIds.length === 0) return;

    try {
      const response = await fetch("/api/photos/batch/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoIds,
          rating,
          userName: user?.name,
        }),
      });

      if (response.ok) {
        setGalleryPhotos((prev) =>
          prev.map((photo) =>
            photoIds.includes(photo.id) ? { ...photo, rating } : photo,
          ),
        );

        if (selectedPhoto && photoIds.includes(selectedPhoto.id)) {
          setSelectedPhoto((prev) => (prev ? { ...prev, rating } : null));
        }

        photoIds.forEach((photoId) => onToggleSelection(photoId));

        onPhotosChange?.();
        alert(
          `${photoIds.length} Foto${photoIds.length > 1 ? "s" : ""} mit ${rating} Stern${rating > 1 ? "en" : ""} bewertet`,
        );
      } else {
        alert("Fehler beim Bewerten der Fotos");
      }
    } catch (error) {
      alert("Fehler beim Bewerten der Fotos");
    }
  };

  const handleDeleteSelectedPhotos = async () => {
    const photoIds = Array.from(selectedPhotoIds);
    if (photoIds.length === 0) return;

    try {
      const response = await fetch("/api/photos/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds }),
      });

      const result = await response.json();

      if (response.ok) {
        setGalleryPhotos((prev) =>
          prev.filter((photo) => !result.deleted.includes(photo.id)),
        );

        if (selectedPhoto && result.deleted.includes(selectedPhoto.id)) {
          setSelectedPhoto(null);
          window.location.hash = "";
        }

        result.deleted.forEach((photoId: string) => {
          selectedPhotoIds.delete(photoId);
        });

        if (result.errors && result.errors.length > 0) {
          alert(
            `${result.success} Foto(s) gelöscht, ${result.failed} fehlgeschlagen`,
          );
        } else {
          alert(`${result.success} Foto(s) erfolgreich gelöscht`);
        }

        result.deleted.forEach((photoId: string) => {
          onToggleSelection(photoId);
        });

        onPhotosChange?.();
      } else {
        if (result.deleted && result.deleted.length > 0) {
          setGalleryPhotos((prev) =>
            prev.filter((photo) => !result.deleted.includes(photo.id)),
          );
          result.deleted.forEach((photoId: string) => {
            selectedPhotoIds.delete(photoId);
          });
        }
        alert(`Fehler beim Löschen: ${result.error || "Unbekannter Fehler"}`);
      }
    } catch (error) {
      alert("Fehler beim Löschen der ausgewählten Fotos");
    }
  };

  return (
    <div className="space-y-6">
      {/* Gallery Grid */}
      <div
        className="gallery-grid-responsive grid gap-2 sm:gap-3 md:gap-4"
        data-testid="gallery-grid"
      >
        {filteredPhotos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={{
              id: photo.id,
              src: photo.src,
              alt: photo.alt,
              rating: photo.rating || 0,
              isLiked: photo.isLiked || false,
              comments: photo.comments || [],
              isSelected: selectedPhotoIds.has(photo.id),
            }}
            onOpenLightbox={() => handleOpenLightbox(photo)}
            onToggleLike={handleToggleLike}
            onRatingChange={handleRatingChange}
            onToggleSelection={onToggleSelection}
            onDelete={isPublicView ? undefined : handleDeletePhoto}
          />
        ))}
      </div>

      {/* Lightbox */}
      <Lightbox
        photo={selectedPhoto}
        onClose={handleCloseLightbox}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToggleLike={handleToggleLike}
        onRatingChange={handleRatingChange}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
