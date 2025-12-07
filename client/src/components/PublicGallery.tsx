import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PhotoGallery from "./PhotoGallery";
import CollapsibleSelectionPanel from "./CollapsibleSelectionPanel";
import SubGalleries from "./SubGalleries";
import Breadcrumb from "./Breadcrumb";
import PasswordProtection from "./PasswordProtection";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Menu, Download, Calendar, Image } from "lucide-react";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { usePhotos } from "@/contexts/PhotoContext";
import { useToast } from "@/hooks/use-toast";
import LoadingOverlay from "./LoadingOverlay";

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

interface Gallery {
  id: string;
  name: string;
  createdAt: string;
  parentId?: string;
  userId?: string; // Assuming gallery has a userId for owner identification
}

interface PublicGalleryData {
  gallery: Gallery;
  photos: Photo[];
}

function PublicGalleryContent() {
  const { galleryId } = useParams<{ galleryId: string }>();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterState>({
    showOnlyLiked: false,
    showOnlyRated: false,
    minStars: 0,
    maxStars: 5
  });

  // State for loading overlay during batch rating
  const [isBatchRating, setIsBatchRating] = useState(false);

  const handleRatingChange = async (photoId: string, newRating: number) => {
    try {
      // Use public API endpoint instead of authenticated one
      const response = await fetch(`/api/public/photos/${photoId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rating: newRating,
          userName: 'Anonymer Besucher'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update local state
        const updatedPhotos = photos.map(p => 
          p.id === photoId ? { ...p, rating: result.photo.rating } : p
        );
        setPhotos(updatedPhotos);
      }
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  };
  const [gallery, setGallery] = useState<PublicGalleryData['gallery'] | null>(null);
  const [currentView, setCurrentView] = useState<'main' | 'subgallery'>('main');
  const [currentSubGalleryId, setCurrentSubGalleryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { toast } = useToast();


  const { photos, setPhotos, updatePhotoLike, updatePhotoRating, selectedPhotoIds, togglePhotoSelection, clearSelection } = usePhotos();

  const handleToggleSelection = (photoId: string) => {
    togglePhotoSelection(photoId);
  };

  const handlePhotosChange = () => {
    // No need to refetch - PhotoContext manages all updates
  };

  const handleSelectSubGallery = async (subGalleryId: string) => {
    setPhotos([]); // Clear photos before navigating to sub-gallery
    window.location.href = `/gallery/${subGalleryId}`;
  };

  const handleLikeToggle = async (photoId: string, isLiked: boolean) => {
    try {
      // Use public API endpoint instead of authenticated one
      const response = await fetch(`/api/public/photos/${photoId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          isLiked,
          userName: 'Anonymer Besucher'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update local state
        const updatedPhotos = photos.map(p => 
          p.id === photoId ? { ...p, isLiked: result.photo.isLiked } : p
        );
        setPhotos(updatedPhotos);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };


  // Check if user already has access to this gallery or its parent
  const getStoredPassword = () => {
    try {
      // First check for this specific gallery
      let stored = localStorage.getItem(`gallery_access_${galleryId}`);
      if (stored) return stored;

      // If we have gallery info and this is a sub-gallery, check parent gallery password
      if (gallery?.parentId) {
        stored = localStorage.getItem(`gallery_access_${gallery.parentId}`);
        if (stored) return stored;
      }

      return null;
    } catch {
      return null;
    }
  };

  const storePassword = (password: string) => {
    try {
      // Store password for current gallery
      localStorage.setItem(`gallery_access_${galleryId}`, password);

      // If this is a main gallery (no parentId), the password will be checked by sub-galleries
      // If this is a sub-gallery, also store the password for the parent gallery
      if (gallery?.parentId) {
        localStorage.setItem(`gallery_access_${gallery.parentId}`, password);
      }
    } catch (error) {
      console.error('Could not store password in localStorage:', error);
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const response = await fetch(`/api/gallery/${galleryId}/public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        const transformedPhotos = data.photos.map((photo: any) => ({
          id: photo.id,
          src: `/${photo.thumbnailPath || photo.filePath}`,
          mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : `/${photo.filePath}`,
          originalSrc: `/${photo.filePath}`, // Always use filePath for original/download
          alt: photo.alt,
          rating: photo.rating || 0,
          isLiked: photo.isLiked || false,
          comments: photo.comments?.map((comment: any) => ({
            id: comment.id,
            author: comment.commenterName || comment.author || 'Unbekannt',
            text: comment.text,
            timestamp: comment.createdAt ? new Date(comment.createdAt).toLocaleString('de-DE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }) : (comment.timestamp || 'Unbekannt')
          })) || []
        }));
        setGallery(data.gallery);
        setPhotos(transformedPhotos);
        setIsPasswordProtected(false);
        storePassword(password);
      } else if (response.status === 401) {
        setPasswordError("Falsches Passwort. Bitte versuche es erneut.");
      } else if (response.status === 403) {
        setPasswordError("Diese Galerie ist passwortgeschützt.");
      } else {
        setPasswordError("Fehler beim Laden der Galerie.");
      }
    } catch (error) {
      console.error("Error checking password:", error);
      setPasswordError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    const fetchGallery = async () => {
      setIsLoading(true);
      setPhotos([]); // Clear photos on new gallery load

      try {
        // First get gallery info to check if it's a sub-gallery
        let galleryInfo;
        try {
          const infoResponse = await fetch(`/api/galleries/${galleryId}`);
          if (infoResponse.ok) {
            galleryInfo = await infoResponse.json();
            setGallery(galleryInfo);
          }
        } catch (error) {
          console.error("Error fetching gallery info:", error);
        }

        // Check for stored passwords - first for current gallery, then for parent if it's a sub-gallery
        let storedPassword = null;
        try {
          storedPassword = localStorage.getItem(`gallery_access_${galleryId}`);
          if (!storedPassword && galleryInfo?.parentId) {
            storedPassword = localStorage.getItem(`gallery_access_${galleryInfo.parentId}`);
          }
        } catch (error) {
          console.error('Error accessing localStorage:', error);
        }

        const requestBody = storedPassword ? { password: storedPassword } : {};
        const method = storedPassword ? 'POST' : 'GET';

        const response = await fetch(`/api/gallery/${galleryId}/public`, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: method === 'POST' ? JSON.stringify(requestBody) : undefined,
        });

        if (response.ok) {
          const data = await response.json();
          const transformedPhotos = data.photos.map((photo: any) => ({
            id: photo.id,
            src: `/${photo.thumbnailPath || photo.filePath}`,
            mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : `/${photo.filePath}`,
            originalSrc: `/${photo.filePath}`,
            alt: photo.alt,
            rating: photo.rating || 0,
            isLiked: photo.isLiked || false,
            comments: photo.comments?.map((comment: any) => ({
              id: comment.id,
              author: comment.commenterName || comment.author || 'Unbekannt',
              text: comment.text,
              timestamp: comment.createdAt ? new Date(comment.createdAt).toLocaleString('de-DE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }) : (comment.timestamp || 'Unbekannt')
            })) || []
          }));
          setGallery(data.gallery);
          setPhotos(transformedPhotos);
        } else if (response.status === 403) {
          setIsPasswordProtected(true);
        } else if (response.status === 401) {
          localStorage.removeItem(`gallery_access_${galleryId}`);
          setIsPasswordProtected(true);
        } else {
          setError("Gallery not found or not public");
        }
      } catch (error) {
        console.error("Error fetching gallery:", error);
        setError("Error loading gallery");
      } finally {
        setIsLoading(false);
      }
    };

    if (galleryId) {
      fetchGallery();
    }
  }, [galleryId]); // Remove setPhotos from dependencies to prevent loops




  const handleOpenLightbox = (photo: Photo) => {
    // Navigate to lightbox page with return path
    const currentPath = window.location.pathname;
    const returnPath = encodeURIComponent(currentPath);

    if (galleryId) {
      navigate(`/gallery/${galleryId}/photo/${photo.id}?return=${returnPath}`);
    }
  };



  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          <Card className="p-6">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-32" />
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="w-full h-48" />
                <div className="p-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isPasswordProtected) {
    return (
      <PasswordProtection
        galleryName={gallery?.name || "Galerie"}
        onPasswordSubmit={handlePasswordSubmit}
        error={passwordError}
        loading={passwordLoading}
      />
    );
  }

  if (error || !gallery || !photos) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-semibold mb-4">Galerie nicht gefunden</h1>
          <p className="text-muted-foreground">
            Die angeforderte Galerie konnte nicht geladen werden.
          </p>
        </Card>
      </div>
    );
  }

  const selectedPhotos = photos ? photos.filter(photo => selectedPhotoIds.has(photo.id)) : [];

  const handleClearSelection = () => {
    clearSelection();
  };

  const handleRemoveFromSelection = (photoId: string) => {
    togglePhotoSelection(photoId);
  };

  const handleSelectAll = () => {
    const filteredPhotos = photos.filter(photo => {
      if (filters.showOnlyLiked && !photo.isLiked) {
        return false;
      }
      if (filters.showOnlyRated && (!photo.rating || photo.rating === 0)) {
        return false;
      }
      if (photo.rating < filters.minStars || photo.rating > filters.maxStars) {
        return false;
      }
      return true;
    });
    const filteredPhotoIds = filteredPhotos.map(photo => photo.id);
    filteredPhotoIds.forEach(id => togglePhotoSelection(id));
  };

  const handleDownloadSelectedPhotos = async () => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    // Show preparation indicator
    const loadingToast = toast({
      title: "Download wird vorbereitet",
      description: (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span>{photoIds.length} Foto{photoIds.length !== 1 ? 's' : ''} werden vorbereitet. Dies kann einige Sekunden dauern...</span>
        </div>
      ),
      duration: Infinity, // Keep the toast open until explicitly dismissed
    });

    try {
      const response = await fetch('/api/public/photos/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoIds: photoIds
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photos_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);

        // Dismiss loading toast only when download dialog appears
        loadingToast.dismiss();
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Create download notification
        if (gallery?.userId) {
          try {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: gallery.userId,
                galleryId: gallery.id,
                type: 'download',
                message: `Jemand hat ${photoIds.length} Foto${photoIds.length !== 1 ? 's' : ''} aus Galerie "${gallery.name}" heruntergeladen`,
                actorName: 'Anonymer Besucher',
                isRead: false
              })
            });
          } catch (error) {
            console.error('Error creating download notification:', error);
          }
        }

        toast({
          title: "Download erfolgreich",
          description: `${photoIds.length} Foto${photoIds.length !== 1 ? 's' : ''} erfolgreich heruntergeladen.`,
        });
      } else {
        loadingToast.dismiss();
        console.error('Failed to download photos');
        toast({
          title: "Fehler",
          description: "Download fehlgeschlagen. Bitte versuche es erneut.",
          variant: "destructive",
        });
      }
    } catch (error) {
      loadingToast.dismiss();
      console.error('Error downloading photos:', error);
      toast({
        title: "Fehler",
        description: "Download fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAllPhotos = async () => {
    const allPhotoIds = photos.map(p => p.id);

    if (allPhotoIds.length === 0) return;

    // Show preparation indicator
    const loadingToast = toast({
      title: "Download wird vorbereitet",
      description: (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span>Alle {allPhotoIds.length} Fotos werden vorbereitet. Dies kann einige Sekunden dauern...</span>
        </div>
      ),
      duration: Infinity, // Keep the toast open until explicitly dismissed
    });

    try {
      const response = await fetch('/api/public/photos/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoIds: allPhotoIds
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photos_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);

        // Dismiss loading toast only when download dialog appears
        loadingToast.dismiss();
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Create download notification for all photos
        if (gallery?.userId) {
          try {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: gallery.userId,
                galleryId: gallery.id,
                type: 'download',
                message: `Jemand hat alle ${allPhotoIds.length} Fotos aus Galerie "${gallery.name}" heruntergeladen`,
                actorName: 'Anonymer Besucher',
                isRead: false
              })
            });
          } catch (error) {
            console.error('Error creating download notification:', error);
          }
        }

        toast({
          title: "Download erfolgreich",
          description: `Alle ${allPhotoIds.length} Fotos erfolgreich heruntergeladen.`,
        });
      } else {
        loadingToast.dismiss();
        console.error('Failed to download photos');
        toast({
          title: "Fehler",
          description: "Download fehlgeschlagen. Bitte versuche es erneut.",
          variant: "destructive",
        });
      }
    } catch (error) {
      loadingToast.dismiss();
      console.error('Error downloading photos:', error);
      toast({
        title: "Fehler",
        description: "Download fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      });
    }
  };

  const handleBatchRatingChange = async (rating: number) => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    // Show loading overlay
    setIsBatchRating(true);

    // Store original ratings for rollback
    const originalRatings = new Map();
    photoIds.forEach(photoId => {
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        originalRatings.set(photoId, photo.rating);
      }
    });

    // Optimistically update all photos
    const optimisticPhotos = photos.map((photo) => {
      if (photoIds.includes(photo.id)) {
        return { ...photo, rating };
      }
      return photo;
    });
    setPhotos(optimisticPhotos);

    try {
      // Use public API endpoint instead of authenticated one
      const response = await fetch('/api/public/photos/batch/rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoIds,
          rating,
          userName: 'Anonymer Besucher'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedPhotos = result.photos || [];

        // Update with server response to ensure consistency
        const finalPhotos = photos.map((photo) => {
          const updatedPhoto = updatedPhotos.find((up: any) => up.id === photo.id);
          return updatedPhoto ? { ...photo, rating: updatedPhoto.rating } : photo;
        });
        setPhotos(finalPhotos);


        toast({
          title: "Bewertung erfolgreich",
          description: `${photoIds.length} Foto${photoIds.length > 1 ? 's' : ''} erfolgreich mit ${rating} Stern${rating > 1 ? 'en' : ''} bewertet`,
        });
      } else {
        // Revert optimistic updates on error
        const revertedPhotos = photos.map((photo) => {
          if (originalRatings.has(photo.id)) {
            return { ...photo, rating: originalRatings.get(photo.id) };
          }
          return photo;
        });
        setPhotos(revertedPhotos);
        const errorData = await response.json();
        console.error('Batch rating failed:', errorData);
        toast({
          title: "Fehler",
          description: "Fehler beim Bewerten der ausgewählten Fotos",
          variant: "destructive",
        });
      }
    } catch (error) {
      // Revert optimistic updates on error
      const revertedPhotos = photos.map((photo) => {
        if (originalRatings.has(photo.id)) {
          return { ...photo, rating: originalRatings.get(photo.id) };
        }
        return photo;
      });
      setPhotos(revertedPhotos);
      console.error('Error setting batch rating:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Bewerten der ausgewählten Fotos",
        variant: "destructive",
      });
    } finally {
      // Hide loading overlay
      setIsBatchRating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Loading Overlay */}
      <LoadingOverlay isVisible={isBatchRating} message="Bilder werden bewertet..." />

      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-medium">
            {gallery?.name}
          </h1>
          <Button
            variant="default"
            size="icon"
            className="md:hidden shadow-lg bg-primary hover:bg-primary/90"
            onClick={() => {
              const event = new CustomEvent('toggleSelectionPanel');
              window.dispatchEvent(event);
            }}
            data-testid="toggle-selection-panel"
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>

        <Breadcrumb items={
          gallery?.parentId
            ? [
                {
                  label: 'Galerie',
                  onClick: () => {
                    window.location.href = `/gallery/${gallery.parentId}`;
                  }
                },
                { label: gallery?.name || 'Galerie', onClick: () => {} }
              ]
            : [
                { label: 'Galerie', onClick: () => {} }
              ]
        } />

        {galleryId && !gallery?.parentId && (
          <SubGalleries
            parentGalleryId={galleryId}
            onSelectSubGallery={handleSelectSubGallery}
            isSubGallery={false}
            onClearSelection={handleClearSelection}
          />
        )}

        <PhotoGallery
          photos={photos}
          selectedPhotoIds={selectedPhotoIds}
          onToggleSelection={handleToggleSelection}
          onPhotosChange={handlePhotosChange}
          isPublicView={true}
          authContext={null}
          filters={filters}
          galleryContext={{
            currentGallery: gallery?.name || 'Unbekannte Galerie',
            parentGallery: gallery?.parentId ? 'Übergeordnete Galerie' : undefined
          }}
          onPhotoClick={handleOpenLightbox}
          onRatingChange={handleRatingChange}
          onLikeToggle={handleLikeToggle}
        />
      </div>

      <CollapsibleSelectionPanel
        selectedPhotos={selectedPhotos}
        onClearSelection={handleClearSelection}
        onRatingChange={handleBatchRatingChange}
        onRemoveFromSelection={handleRemoveFromSelection}
        onSelectAll={handleSelectAll}
        onDownloadSelected={gallery?.allowDownload !== false ? handleDownloadSelectedPhotos : undefined}
        onDownloadAll={gallery?.allowDownload !== false ? handleDownloadAllPhotos : undefined}
        filters={filters}
        onFiltersChange={setFilters}
        showFilters={true}
      />


    </div>
  );
}

export default function PublicGallery() {
  return <PublicGalleryContent />;
}