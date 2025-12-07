import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PhotoCard from "./PhotoCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotos } from "@/contexts/PhotoContext";

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
  onPhotoClick?: (photo: Photo) => void;
}

export default function PhotoGallery({
  photos: initialPhotos, // Keep for compatibility but ignore
  selectedPhotoIds: externalSelectedPhotoIds,
  onToggleSelection: externalOnToggleSelection,
  onPhotosChange,
  isPublicView = false,
  authContext = null,
  filters,
  galleryContext,
  onRatingChange: externalRatingChange,
  onLikeToggle: externalLikeToggle,
  onPhotoClick,
}: PhotoGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    photos: sharedPhotos,
    setPhotos,
    updatePhotoRating,
    updatePhotoLike,
    addPhotoComment,
    selectedPhotoIds: contextSelectedPhotoIds,
    togglePhotoSelection,
  } = usePhotos();
  
  // Use context selection if available, otherwise use external
  const selectedPhotoIds = externalSelectedPhotoIds || contextSelectedPhotoIds;
  const handleToggleSelection = externalOnToggleSelection || togglePhotoSelection;
  // Try to get auth context, but don't fail if it's not available (for public galleries)
  let authUser = null;
  try {
    const auth = useAuth();
    authUser = auth.user;
  } catch (e) {
    // AuthContext not available - this is fine for public galleries
  }

  const user = authContext?.user || authUser;
  const isDelete  =user?.role === "Admin" || user?.role === "Creator";
  
  // Use shared photos as source of truth - ignore initialPhotos completely
  const galleryPhotos = sharedPhotos;

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
    // Navigate to lightbox page with current gallery path
    const currentPath = window.location.pathname;
    const returnPath = encodeURIComponent(currentPath);

    // Extract gallery ID from galleryContext or current path
    const galleryId = galleryContext?.currentGallery
      ? // Try to extract gallery ID from current URL path
        currentPath.split("/galleries/")[1]?.split("/")[0]
      : currentPath.split("/galleries/")[1]?.split("/")[0];

    if (galleryId) {
      navigate(
        `/galleries/${galleryId}/photo/${photo.id}?return=${returnPath}`,
      );
    }
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
      await updatePhotoLike(
        photoId,
        newLikeState,
        user?.name || "Anonymer Besucher",
      );
    } catch (error) {
      console.error("Fehler beim Speichern des Likes:", error);
    }
  };

  const handleRatingChange = async (photoId: string, rating: number) => {
    if (externalRatingChange) {
      externalRatingChange(photoId, rating);
      return;
    }

    try {
      await updatePhotoRating(
        photoId,
        rating,
        user?.name || "Anonymer Besucher",
      );
    } catch (error) {
      console.error("Fehler beim Speichern der Bewertung:", error);
    }
  };

  const handleAddComment = async (
    photoId: string,
    commentText: string,
    commenterName: string = "Anonym",
  ) => {
    try {
      await addPhotoComment(photoId, commentText, commenterName);
      onPhotosChange?.();
    } catch (error) {
      alert("Fehler beim Hinzufügen des Kommentars");
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
        const response = await fetch(`/api/photos/${photoId}?userId=${user?.id || ''}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPhotos(sharedPhotos.filter((photo) => photo.id !== photoId));
        onPhotosChange?.();
      } else {
        alert("Fehler beim Löschen");
      }
    } catch (error) {
      alert("Fehler beim Löschen des Fotos");
    }
  };

 

  const showDeleteButton = !isPublicView && isDelete;

  return (
    <div className="space-y-6">
      {/* Gallery Grid */}
      <div
        ref={containerRef}
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
            onOpenLightbox={() =>
              onPhotoClick ? onPhotoClick(photo) : handleOpenLightbox(photo)
            }
            onToggleLike={handleToggleLike}
            onRatingChange={handleRatingChange}
            onToggleSelection={handleToggleSelection}
            onDelete={showDeleteButton ? handleDeletePhoto : undefined}
          />
        ))}
      </div>
    </div>
  );
}
