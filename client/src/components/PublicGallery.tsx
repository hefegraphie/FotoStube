import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";

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
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    showOnlyLiked: false,
    showOnlyRated: false,
    minStars: 0,
    maxStars: 5
  });
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [gallery, setGallery] = useState<PublicGalleryData['gallery'] | null>(null);
  const [currentView, setCurrentView] = useState<'main' | 'subgallery'>('main');
  const [currentSubGalleryId, setCurrentSubGalleryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { toast } = useToast();


  const { refetch } = useQuery<PublicGalleryData>({
    queryKey: ['/api/gallery', galleryId, 'public'],
    enabled: !!galleryId,
    queryFn: async () => {
      const response = await fetch(`/api/gallery/${galleryId}/public`);
      if (!response.ok) {
        throw new Error('Failed to fetch public gallery');
      }
      const result = await response.json();

      const transformedPhotos = result.photos.map((photo: any) => ({
        id: photo.id,
        src: `/${photo.thumbnailPath || photo.filePath}`,
        mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : undefined,
        originalSrc: photo.filePath ? `/${photo.filePath}` : undefined,
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

      setGallery(result.gallery);
      setPhotos(transformedPhotos);

      return {
        gallery: result.gallery,
        photos: transformedPhotos
      };
    }
  });

  const handleToggleSelection = (photoId: string) => {
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

  const handlePhotosChange = () => {
    refetch();
  };

  const handleSelectSubGallery = async (subGalleryId: string) => {
    window.location.href = `/gallery/${subGalleryId}`;
  };

  const handleRatingChange = async (photoId: string, newRating: number) => {
    const photo = photos.find(p => p.id === photoId);

    setPhotos(prev =>
      prev.map(photo =>
        photo.id === photoId
          ? { ...photo, rating: newRating }
          : photo
      )
    );

    try {
      await fetch(`/api/photos/${photoId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating: newRating }),
      });

      if (photo && gallery?.userId) {
        const message = `Jemand hat Bild "${photo.alt}" in Galerie "${gallery.name}" mit ${newRating} Stern${newRating !== 1 ? 'en' : ''} bewertet`;
        console.log('Sending rating notification to gallery owner:', { ownerId: gallery.userId, message });

        const notificationResponse = await fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: gallery.userId,
            galleryId: gallery.id,
            photoId,
            type: 'rating',
            message,
            actorName: 'Anonymer Besucher',
            isRead: false
          })
        });

        if (!notificationResponse.ok) {
          const errorData = await response.text();
          console.error('Notification failed:', errorData);
        } else {
          console.log('Rating notification sent successfully');
          // Trigger a notification refresh for any authenticated users
          window.dispatchEvent(new CustomEvent('refreshNotifications'));
        }
      }
    } catch (error) {
      console.error('Error in rating/notification:', error);
    }
  };

  const handleLikeToggle = async (photoId: string, isLiked: boolean) => {
    const photo = photos.find(p => p.id === photoId);
    console.log(`Toggling like for photo ${photoId}:`, isLiked);

    setPhotos(prev =>
      prev.map(photo =>
        photo.id === photoId
          ? { ...photo, isLiked: isLiked }
          : photo
      )
    );

    try {
      const response = await fetch(`/api/photos/${photoId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isLiked }),
      });

      const data = await response.json();
      console.log('Like response:', data);

      setPhotos(prev =>
        prev.map(photo =>
          photo.id === photoId
            ? { ...photo, isLiked: data.isLiked }
            : photo
        )
      );

      if (photo && gallery?.userId) {
        const action = data.isLiked ? 'geliked' : 'entliked';
        const message = `Jemand hat Bild "${photo.alt}" in Galerie "${gallery.name}" ${action}`;
        console.log('Sending like notification to gallery owner:', { ownerId: gallery.userId, message });

        const notificationResponse = await fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: gallery.userId,
            galleryId: gallery.id,
            photoId,
            type: 'like',
            message,
            actorName: 'Anonymer Besucher',
            isRead: false
          })
        });

        if (!notificationResponse.ok) {
          const errorData = await response.text();
          console.error('Like notification failed:', errorData);
        } else {
          console.log('Like notification sent successfully');
        }
      }
    } catch (error) {
      console.error('Error in like/notification:', error);
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
          mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : undefined,
          originalSrc: photo.filePath ? `/${photo.filePath}` : undefined,
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
            mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : undefined,
            originalSrc: photo.filePath ? `/${photo.filePath}` : undefined,
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
          // Gallery is password protected
          setIsPasswordProtected(true);
          // Try to get gallery name for password dialog
          try {
            const infoResponse = await fetch(`/api/galleries/${galleryId}`);
            if (infoResponse.ok) {
              const galleryInfo = await infoResponse.json();
              setGallery(galleryInfo);
            }
          } catch (error) {
            console.error("Error fetching gallery info:", error);
          }
        } else if (response.status === 401) {
          // Stored password is wrong, clear it and show password dialog
          localStorage.removeItem(`gallery_access_${galleryId}`);
          setIsPasswordProtected(true);
          try {
            const infoResponse = await fetch(`/api/galleries/${galleryId}`);
            if (infoResponse.ok) {
              const galleryInfo = await infoResponse.json();
              setGallery(galleryInfo);
            }
          } catch (error) {
            console.error("Error fetching gallery info:", error);
          }
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
  }, [galleryId]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#lightbox-')) {
        const photoId = hash.replace('#lightbox-', '');
        const photo = photos.find(p => p.id === photoId);
        if (photo && (!selectedPhoto || selectedPhoto.id !== photoId)) {
          setSelectedPhoto(photo);
        }
      } else if (selectedPhoto) {
        setSelectedPhoto(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [photos, selectedPhoto]);


  const handleOpenLightbox = (photo: Photo) => {
    setSelectedPhoto(photo);
    window.location.hash = `lightbox-${photo.id}`;
  };

  const handleCloseLightbox = () => {
    setSelectedPhoto(null);
    if (window.location.hash.startsWith('#lightbox-')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const handlePrevious = () => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    const previousPhoto = photos[previousIndex];
    setSelectedPhoto(previousPhoto);
    window.location.hash = `lightbox-${previousPhoto.id}`;
  };

  const handleNext = () => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    const nextPhoto = photos[nextIndex];
    setSelectedPhoto(nextPhoto);
    window.location.hash = `lightbox-${nextPhoto.id}`;
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
    setSelectedPhotoIds(new Set());
  };

  const handleRemoveFromSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(photoId);
      return newSet;
    });
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
    setSelectedPhotoIds(new Set(filteredPhotoIds));
  };

  const handleDownloadSelectedPhotos = async () => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    try {
      const response = await fetch('/api/photos/download', {
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
          title: "Download gestartet",
          description: `${photoIds.length} Foto${photoIds.length !== 1 ? 's' : ''} werden heruntergeladen.`,
        });
      } else {
        console.error('Failed to download photos');
        toast({
          title: "Fehler",
          description: "Download fehlgeschlagen. Bitte versuche es erneut.",
          variant: "destructive",
        });
      }
    } catch (error) {
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

    try {
      const response = await fetch('/api/photos/download', {
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
          title: "Download gestartet",
          description: `Alle ${allPhotoIds.length} Fotos werden heruntergeladen.`,
        });
      } else {
        console.error('Failed to download photos');
        toast({
          title: "Fehler",
          description: "Download fehlgeschlagen. Bitte versuche es erneut.",
          variant: "destructive",
        });
      }
    } catch (error) {
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

    try {
      const response = await fetch('/api/photos/batch/rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoIds,
          rating
        }),
      });

      if (response.ok) {
        setSelectedPhotoIds(new Set());
        refetch();
        toast({
          title: "Bewertung erfolgreich",
          description: `${photoIds.length} Foto${photoIds.length > 1 ? 's' : ''} erfolgreich mit ${rating} Stern${rating > 1 ? 'en' : ''} bewertet`,
        });
      } else {
        const errorData = await response.json();
        console.error('Batch rating failed:', errorData);
        toast({
          title: "Fehler",
          description: "Fehler beim Bewerten der ausgewählten Fotos",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error setting batch rating:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Bewerten der ausgewählten Fotos",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
        <Card className="p-4 md:p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold mb-2">
                {gallery?.name}
              </h1>
              <p className="text-muted-foreground">
                {photos.length} Foto{photos.length !== 1 ? 's' : ''} •
                Erstellt am {gallery?.createdAt ? new Date(gallery.createdAt).toLocaleDateString('de-DE') : ''}
              </p>
            </div>
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
        </Card>

        <Breadcrumb items={
          gallery?.parentId
            ? [
                {
                  label: 'Hey',
                  onClick: () => {
                    window.location.href = `/gallery/${gallery.parentId}`;
                  }
                },
                { label: gallery?.name || 'Galerie', onClick: () => {} }
              ]
            : [
                { label: 'Hey', onClick: () => {} }
              ]
        } />

        {galleryId && !gallery?.parentId && (
          <SubGalleries
            parentGalleryId={galleryId}
            onSelectSubGallery={handleSelectSubGallery}
            isSubGallery={false}
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
        />
      </div>

      <CollapsibleSelectionPanel
        selectedPhotos={selectedPhotos}
        onClearSelection={handleClearSelection}
        onRatingChange={handleBatchRatingChange}
        onRemoveFromSelection={handleRemoveFromSelection}
        onSelectAll={handleSelectAll}
        onDownloadSelected={handleDownloadSelectedPhotos}
        onDownloadAll={handleDownloadAllPhotos}
        filters={filters}
        onFiltersChange={setFilters}
        showFilters={true}
      />
    </div>
  );
}

export default function PublicGallery() {
  return (
    <NotificationProvider>
      <PublicGalleryContent />
    </NotificationProvider>
  );
}