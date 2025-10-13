import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Heart,
  Download,
  MessageCircle,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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
}

export default function LightboxPage() {
  const { galleryId, photoId } = useParams<{ galleryId: string; photoId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [newComment, setNewComment] = useState("");
  const [commenterName, setCommenterName] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const queryClient = useQueryClient();

  // Check if this is a public gallery (path starts with /gallery/ instead of /galleries/)
  const isPublicGallery = window.location.pathname.includes('/gallery/');

  // Auth optional for public galleries
  let user = null;
  try {
    const { user: authUser } = useAuth();
    user = authUser;
  } catch (error) {}

  // Get return path from search params
  const returnPath = searchParams.get('return') || (isPublicGallery ? `/gallery/${galleryId}` : `/galleries/${galleryId}`);

  // Always use PhotoContext for consistency - both private and public galleries
  const { photos: contextPhotos, setPhotos, updatePhotoRating, updatePhotoLike, addPhotoComment, getPhoto } = usePhotos();

  // If context is empty (e.g., direct page load via F5), fetch photos
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(contextPhotos.length === 0);

  useEffect(() => {
    const loadPhotos = async () => {
      // Only load if context is empty
      if (contextPhotos.length > 0) {
        setIsLoadingPhotos(false);
        return;
      }

      if (!galleryId) return;

      setIsLoadingPhotos(true);
      try {
        let response;
        if (isPublicGallery) {
          // For public galleries, check for stored password
          let storedPassword = null;
          try {
            storedPassword = localStorage.getItem(`gallery_access_${galleryId}`);
          } catch (error) {
            console.error('Error accessing localStorage:', error);
          }

          const requestBody = storedPassword ? { password: storedPassword } : {};
          const method = storedPassword ? 'POST' : 'GET';

          response = await fetch(`/api/gallery/${galleryId}/public`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method === 'POST' ? JSON.stringify(requestBody) : undefined,
          });
        } else {
          // For private galleries
          response = await fetch(`/api/galleries/${galleryId}/photos?userId=${user?.id}`);
        }

        if (response.ok) {
          const data = await response.json();
          const photosData = isPublicGallery ? data.photos : data;
          
          const transformedPhotos = photosData.map((photo: any) => ({
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

          setPhotos(transformedPhotos);
        }
      } catch (error) {
        console.error('Error loading photos for lightbox:', error);
      } finally {
        setIsLoadingPhotos(false);
      }
    };

    loadPhotos();
  }, [galleryId, contextPhotos.length, isPublicGallery, setPhotos, user?.id]);

  // Use photos from PhotoContext for all galleries
  const photos = contextPhotos;
  const currentPhoto = getPhoto(photoId || '');
  const currentIndex = photos.findIndex(p => p.id === photoId);

  // Preload adjacent images
  useEffect(() => {
    if (currentIndex === -1) return;

    const preloadImage = (src: string) => {
      const img = new Image();
      img.src = src;
    };

    // Preload next image
    if (currentIndex < photos.length - 1) {
      const nextPhoto = photos[currentIndex + 1];
      preloadImage(nextPhoto.mediumSrc || nextPhoto.src);
    }

    // Preload previous image
    if (currentIndex > 0) {
      const prevPhoto = photos[currentIndex - 1];
      preloadImage(prevPhoto.mediumSrc || prevPhoto.src);
    }
  }, [currentIndex, photos]);

  // Navigate to previous/next photo
  const navigateToPhoto = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < photos.length) {
      const newPhotoId = photos[newIndex].id;
      const lightboxPath = isPublicGallery
        ? `/gallery/${galleryId}/photo/${newPhotoId}`
        : `/galleries/${galleryId}/photo/${newPhotoId}`;
      navigate(`${lightboxPath}?return=${encodeURIComponent(returnPath)}`, { replace: true });
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      navigateToPhoto(currentIndex - 1);
    } else {
      navigateToPhoto(photos.length - 1); // Loop to last
    }
  };

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      navigateToPhoto(currentIndex + 1);
    } else {
      navigateToPhoto(0); // Loop to first
    }
  };

  const handleClose = () => {
    // No need to invalidate - PhotoContext keeps everything in sync
    navigate(returnPath);
  };

  const handleLikeToggle = async () => {
    if (!currentPhoto) return;

    const newLikeState = !currentPhoto.isLiked;

    try {
      await updatePhotoLike(currentPhoto.id, newLikeState, user?.name || 'Anonymer Besucher');
      // No refetch needed - PhotoContext handles optimistic updates
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleRatingChange = async (newRating: number) => {
    if (!currentPhoto) return;

    try {
      await updatePhotoRating(currentPhoto.id, newRating, user?.name || 'Anonymer Besucher');
      // No refetch needed - PhotoContext handles optimistic updates
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  };

  const handleAddComment = async () => {
    if (!currentPhoto || !newComment.trim() || !commenterName.trim()) return;

    const commentText = newComment.trim();
    const authorName = commenterName.trim();

    // Clear form immediately for better UX
    setNewComment("");
    setCommenterName("");

    try {
      // Use PhotoContext for all galleries - it handles optimistic updates
      await addPhotoComment(currentPhoto.id, commentText, authorName);
    } catch (error) {
      // Restore form data on error
      setNewComment(commentText);
      setCommenterName(authorName);
      alert("Fehler beim Hinzufügen des Kommentars");
    }
  };

  const handleDownloadPhoto = async () => {
    if (!currentPhoto) return;

    try {
      // Always use originalSrc for downloads to get full-size image
      const downloadSrc = currentPhoto.originalSrc || currentPhoto.src;
      const response = await fetch(downloadSrc);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileName = currentPhoto.alt.replace(/[^a-z0-9]/gi, "_").toLowerCase() || currentPhoto.id;
      const extension = downloadSrc.split(".").pop() || "jpg";
      a.download = `${fileName}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading photo:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleAddComment();
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

  // Swipe handling for mobile
  const [touchStartX, setTouchStartX] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchStartX - touchEndX;
    const threshold = 50;

    if (deltaX > threshold) {
      handleNext();
    } else if (deltaX < -threshold) {
      handlePrevious();
    }
  };

  if (!currentPhoto || isLoadingPhotos) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Foto wird geladen...</p>
          <Button
            variant="outline"
            onClick={handleClose}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Galerie
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b p-4 flex items-center justify-between">
        <Button variant="ghost" onClick={handleClose} className="flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Galerie
        </Button>

        <div className="text-sm text-muted-foreground">
          {currentIndex >= 0 ? currentIndex + 1 : '?'} von {photos.length}
        </div>

        {isMobile ? (
          <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle>{currentPhoto.alt}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 overflow-y-auto max-h-[calc(80vh-8rem)] pb-4">
                {/* Rating */}
                <div>
                  <h4 className="font-medium mb-2">Bewertung</h4>
                  <div className="flex items-center space-x-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRatingChange(star)}
                      >
                        <Star
                          className={`w-5 h-5 ${star <= currentPhoto.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentPhoto.rating} Sterne
                  </p>
                </div>

                {/* Like Button */}
                <Button
                  variant="ghost"
                  onClick={handleLikeToggle}
                  className="w-full"
                >
                  <Heart
                    className={`w-5 h-5 ${currentPhoto.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
                  />
                  <span className="ml-2">
                    {currentPhoto.isLiked ? "Gefällt mir" : "Gefällt mir nicht"}
                  </span>
                </Button>

                {/* Download Button */}
                <Button onClick={handleDownloadPhoto} className="w-full">
                  <Download className="w-5 h-5 mr-2" />
                  Bild herunterladen
                </Button>

                {/* Comments */}
                <div>
                  <h4 className="font-medium mb-4">
                    Kommentare ({currentPhoto.comments.length})
                  </h4>
                  <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
                    {currentPhoto.comments.map((comment) => (
                      <Card key={comment.id} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">
                            {comment.author}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {comment.timestamp}
                          </span>
                        </div>
                        <p className="text-sm">{comment.text}</p>
                      </Card>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Ihr Name"
                    value={commenterName}
                    onChange={(e) => setCommenterName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm mb-2"
                  />
                  <Textarea
                    placeholder="Kommentar hinzufügen..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={handleKeyPress}
                    rows={3}
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || !commenterName.trim()}
                    size="sm"
                    className="mt-2 w-full"
                  >
                    Kommentar hinzufügen
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className={`flex h-screen ${isMobile ? 'pt-16' : 'pt-20'}`}>
        {/* Photo Area */}
        <div className={`flex-1 flex items-center justify-center min-h-0 ${isMobile ? 'p-0 pb-20' : 'p-4'}`}>
          {!isMobile && (
            <Button
              variant="ghost"
              className="mr-4 bg-black/10 hover:bg-black/40 h-16 w-16"
              onClick={handlePrevious}
            >
              <ChevronLeft className="w-12 h-12" />
            </Button>
          )}

          <div
            className="flex items-center justify-center w-full h-full overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              maxWidth: isMobile ? '100vw' : 'calc(100vw - 8rem)',
              maxHeight: isMobile ? 'calc(100vh - 9rem)' : 'calc(100vh - 10rem)'
            }}
          >
            <img
              src={currentPhoto.mediumSrc || currentPhoto.src}
              alt={currentPhoto.alt}
              className="max-w-full max-h-full object-contain"
              style={{
                width: 'auto',
                height: 'auto',
                aspectRatio: 'auto'
              }}
              loading="eager"
              decoding="async"
            />
          </div>

          {!isMobile && (
            <Button
              variant="ghost"
              className="ml-4 bg-black/10 hover:bg-black/40 h-16 w-16"
              onClick={handleNext}
            >
              <ChevronRight className="w-12 h-12" />
            </Button>
          )}
        </div>

        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="w-80 bg-card border-l p-6 overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">{currentPhoto.alt}</h3>

            {/* Rating */}
            <div className="mb-4">
              <h4 className="font-medium mb-2">Bewertung</h4>
              <div className="flex items-center space-x-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRatingChange(star)}
                  >
                    <Star
                      className={`w-5 h-5 ${star <= currentPhoto.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {currentPhoto.rating} Sterne
              </p>
            </div>

            {/* Like Button */}
            <Button
              variant="ghost"
              onClick={handleLikeToggle}
              className="mb-4"
            >
              <Heart
                className={`w-5 h-5 ${currentPhoto.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
              />
              <span className="ml-2">
                {currentPhoto.isLiked ? "Gefällt mir" : "Gefällt mir nicht"}
              </span>
            </Button>

            {/* Download Button */}
            <Button onClick={handleDownloadPhoto} className="mb-6">
              <Download className="w-5 h-5 mr-2" />
              Bild herunterladen
            </Button>

            {/* Comments */}
            <div>
              <h4 className="font-medium mb-4">
                Kommentare ({currentPhoto.comments.length})
              </h4>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {currentPhoto.comments.map((comment) => (
                  <Card key={comment.id} className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">
                        {comment.author}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {comment.timestamp}
                      </span>
                    </div>
                    <p className="text-sm">{comment.text}</p>
                  </Card>
                ))}
              </div>
              <input
                type="text"
                placeholder="Ihr Name"
                value={commenterName}
                onChange={(e) => setCommenterName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm mb-2"
              />
              <Textarea
                placeholder="Kommentar hinzufügen..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyPress}
                rows={3}
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || !commenterName.trim()}
                size="sm"
                className="mt-2"
              >
                Kommentar hinzufügen
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Controls */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t p-4 flex justify-between items-center">
          <Button variant="ghost" size="icon" onClick={handleDownloadPhoto}>
            <Download className="w-5 h-5" />
          </Button>
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRatingChange(star)}
              >
                <Star
                  className={`w-5 h-5 ${star <= currentPhoto.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                />
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLikeToggle}
          >
            <Heart
              className={`w-5 h-5 ${currentPhoto.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMobileSidebar(true)}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}