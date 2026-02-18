import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Heart,
  Send,
  Download,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

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

interface Gallery {
  id: string;
  name: string;
  allowDownload?: boolean;
}

export default function PublicLightboxPage() {
  const { galleryId, photoId } = useParams<{ galleryId: string; photoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<Photo | null>(null);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commenterName, setCommenterName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [touchStartX, setTouchStartX] = useState(0);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const returnPath = new URLSearchParams(location.search).get("return") || `/gallery/${galleryId}`;

  useEffect(() => {
    const fetchGalleryData = async () => {
      try {
        let storedPassword = null;
        try {
          storedPassword = localStorage.getItem(`gallery_access_${galleryId}`);
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
          setGallery(data.gallery);

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
              timestamp: comment.createdAt ? new Date(comment.createdAt).toLocaleString('de-DE') : 'Unbekannt'
            })) || []
          }));

          setPhotos(transformedPhotos);
          const current = transformedPhotos.find((p: Photo) => p.id === photoId);
          setCurrentPhoto(current || null);
        } else if (response.status === 403 || response.status === 401) {
          navigate(`/gallery/${galleryId}`);
        }
      } catch (error) {
        console.error("Error fetching gallery:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (galleryId && photoId) {
      fetchGalleryData();
    }
  }, [galleryId, photoId, navigate]);

  const handleClose = () => {
    navigate(decodeURIComponent(returnPath));
  };

  const handlePrevious = () => {
    if (!currentPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === currentPhoto.id);
    if (currentIndex > 0) {
      const prevPhoto = photos[currentIndex - 1];
      navigate(`/gallery/${galleryId}/photo/${prevPhoto.id}?return=${encodeURIComponent(returnPath)}`, {
        replace: true,
      });
    } else {
      const lastPhoto = photos[photos.length - 1];
      navigate(`/gallery/${galleryId}/photo/${lastPhoto.id}?return=${encodeURIComponent(returnPath)}`, {
        replace: true,
      });
    }
  };

  const handleNext = () => {
    if (!currentPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === currentPhoto.id);
    if (currentIndex < photos.length - 1) {
      const nextPhoto = photos[currentIndex + 1];
      navigate(`/gallery/${galleryId}/photo/${nextPhoto.id}?return=${encodeURIComponent(returnPath)}`, {
        replace: true,
      });
    } else {
      const firstPhoto = photos[0];
      navigate(`/gallery/${galleryId}/photo/${firstPhoto.id}?return=${encodeURIComponent(returnPath)}`, {
        replace: true,
      });
    }
  };

  const handleRatingChange = async (rating: number) => {
    if (!currentPhoto) return;
    try {
      const response = await fetch(`/api/public/photos/${currentPhoto.id}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, userName: 'Anonymer Besucher' }),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentPhoto({ ...currentPhoto, rating: result.photo.rating });
      }
    } catch (error) {
      console.error("Error updating rating:", error);
    }
  };

  const handleLikeToggle = async () => {
    if (!currentPhoto) return;
    try {
      const response = await fetch(`/api/public/photos/${currentPhoto.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLiked: !currentPhoto.isLiked, userName: 'Anonymer Besucher' }),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentPhoto({ ...currentPhoto, isLiked: result.photo.isLiked });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleAddComment = async () => {
    if (!currentPhoto || !newComment.trim() || !commenterName.trim()) return;

    try {
      const response = await fetch(`/api/public/photos/${currentPhoto.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commenterName: commenterName.trim(), text: newComment.trim() }),
      });

      if (response.ok) {
        const newCommentObj = {
          id: Date.now().toString(),
          author: commenterName.trim(),
          text: newComment.trim(),
          timestamp: new Date().toLocaleString('de-DE'),
        };

        setCurrentPhoto({
          ...currentPhoto,
          comments: [...currentPhoto.comments, newCommentObj],
        });

        setNewComment("");
        toast({
          title: "Kommentar hinzugefügt",
          description: "Dein Kommentar wurde erfolgreich gespeichert.",
        });
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPhoto = async () => {
    if (!currentPhoto) return;

    const loadingToast = toast({
      title: "Download wird vorbereitet",
      description: "Das Foto wird vorbereitet...",
      duration: Infinity,
    });

    try {
      const response = await fetch('/api/public/photos/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoIds: [currentPhoto.id]
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentPhoto.alt || 'photo'}.zip`;
        document.body.appendChild(a);
        loadingToast.dismiss();
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Download erfolgreich",
          description: "Das Foto wurde erfolgreich heruntergeladen.",
        });
      } else {
        loadingToast.dismiss();
        toast({
          title: "Fehler",
          description: "Download fehlgeschlagen. Bitte versuche es erneut.",
          variant: "destructive",
        });
      }
    } catch (error) {
      loadingToast.dismiss();
      console.error('Error downloading photo:', error);
      toast({
        title: "Fehler",
        description: "Download fehlgeschlagen. Bitte versuche es erneut.",
        variant: "destructive",
      });
    }
  };

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleAddComment();
    }
  };

  // Keyboard navigation
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
  }, [currentPhoto, photos]);

  // Preload adjacent images
  useEffect(() => {
    if (!currentPhoto || photos.length === 0) return;

    const currentIndex = photos.findIndex(p => p.id === currentPhoto.id);
    if (currentIndex === -1) return;

    const preloadImage = (src: string) => {
      const img = new Image();
      img.src = src;
    };

    if (currentIndex < photos.length - 1) {
      const nextPhoto = photos[currentIndex + 1];
      preloadImage(nextPhoto.mediumSrc || nextPhoto.src);
    }

    if (currentIndex > 0) {
      const prevPhoto = photos[currentIndex - 1];
      preloadImage(prevPhoto.mediumSrc || prevPhoto.src);
    }
  }, [currentPhoto, photos]);

  if (isLoading || !currentPhoto) {
    return <div className="flex items-center justify-center h-screen">Lädt...</div>;
  }

  const currentIndex = photos.findIndex(p => p.id === currentPhoto.id);
  const allowDownload = gallery?.allowDownload ?? true;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b p-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={handleClose}
          className="flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Galerie
        </Button>

        <div className="text-sm text-muted-foreground">
          {currentIndex >= 0 ? currentIndex + 1 : "?"} von {photos.length}
        </div>

        {/* Desktop Sidebar Toggle - hier nur X für Close, da Controls unten sind auf Mobile */}
        {!isMobile ? (
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        ) : (
          /* Placeholder für Layout-Symmetrie auf Mobile, falls gewünscht, sonst leer */
          <div className="w-8" />
        )}
      </div>

      {/* Main Content */}
      <div className={`flex h-screen ${isMobile ? "pt-16 pb-20" : "pt-20"}`}>
        {/* Photo Area */}
        <div 
          className={`flex-1 flex items-center justify-center min-h-0 ${isMobile ? "p-0" : "p-4"} relative`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {!isMobile && (
            <Button
              variant="ghost"
              className="absolute left-4 top-1/2 -translate-y-1/2 h-16 w-16 rounded-full bg-black/10 hover:bg-black/40 hidden md:flex"
              onClick={handlePrevious}
            >
              <ChevronLeft className="w-12 h-12" />
            </Button>
          )}

          <div className="flex items-center justify-center w-full h-full overflow-hidden">
            <img
              src={currentPhoto.mediumSrc || currentPhoto.src}
              alt={currentPhoto.alt}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: isMobile ? "calc(100vh - 9rem)" : "calc(100vh - 10rem)" }}
            />
          </div>

          {!isMobile && (
            <Button
              variant="ghost"
              className="absolute right-4 top-1/2 -translate-y-1/2 h-16 w-16 rounded-full bg-black/10 hover:bg-black/40 hidden md:flex"
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
                <button
                  onClick={() => handleRatingChange(0)}
                  className="hover:scale-110 transition-transform text-muted-foreground hover:text-red-500"
                  title="Bewertung löschen"
                >
                  <X className="w-4 h-4" />
                </button>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRatingChange(star)}
                    className="hover:scale-110 transition-transform"
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
              className="mb-4 w-full"
            >
              <Heart
                className={`w-5 h-5 ${currentPhoto.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
              />
              <span className="ml-2">
                {currentPhoto.isLiked ? "Gefällt mir" : "Gefällt mir nicht"}
              </span>
            </Button>

            {/* Download Button */}
            {allowDownload && (
              <Button onClick={handleDownloadPhoto} className="mb-6 w-full">
                <Download className="w-5 h-5 mr-2" />
                Bild herunterladen
              </Button>
            )}

            {/* Comments */}
            <div>
              <h4 className="font-medium mb-4">
                Kommentare ({currentPhoto.comments.length})
              </h4>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {currentPhoto.comments.map((comment) => (
                  <Card key={comment.id} className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{comment.author}</span>
                      <span className="text-xs text-muted-foreground">
                        {comment.timestamp}
                      </span>
                    </div>
                    <p className="text-sm">{comment.text}</p>
                  </Card>
                ))}
              </div>
              <Input
                type="text"
                placeholder="Ihr Name"
                value={commenterName}
                onChange={(e) => setCommenterName(e.target.value)}
                className="w-full mb-2"
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
        )}
      </div>

      {/* Mobile Bottom Controls (Footer) */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t p-4 flex justify-between items-center">
          {allowDownload && (
            <Button variant="ghost" size="icon" onClick={handleDownloadPhoto}>
              <Download className="w-5 h-5" />
            </Button>
          )}

          {/* Compact Rating */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleRatingChange(0)}
              className="hover:scale-110 transition-transform text-muted-foreground hover:text-red-500"
              title="Bewertung löschen"
            >
              <X className="w-4 h-4" />
            </button>
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

          <Button variant="ghost" size="icon" onClick={handleLikeToggle}>
            <Heart
              className={`w-5 h-5 ${currentPhoto.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
            />
          </Button>

          {/* Mobile Comments Sheet Trigger */}
          <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <MessageCircle className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle>{currentPhoto.alt}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 overflow-y-auto max-h-[calc(80vh-8rem)] pb-4">
                {/* Full Rating in Sheet */}
                <div>
                  <h4 className="font-medium mb-2">Bewertung</h4>
                  <div className="flex items-center space-x-1 mb-2">
                    <button onClick={() => handleRatingChange(0)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => handleRatingChange(star)}>
                        <Star
                          className={`w-5 h-5 ${star <= currentPhoto.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comments List */}
                <div>
                  <h4 className="font-medium mb-4">
                    Kommentare ({currentPhoto.comments.length})
                  </h4>
                  <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
                    {currentPhoto.comments.map((comment) => (
                      <Card key={comment.id} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">
                            {comment.timestamp}
                          </span>
                        </div>
                        <p className="text-sm">{comment.text}</p>
                      </Card>
                    ))}
                  </div>
                  <Input
                    type="text"
                    placeholder="Ihr Name"
                    value={commenterName}
                    onChange={(e) => setCommenterName(e.target.value)}
                    className="w-full mb-2"
                  />
                  <Textarea
                    placeholder="Kommentar hinzufügen..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
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
        </div>
      )}
    </div>
  );
}
