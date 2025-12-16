
import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, ChevronLeft, ChevronRight, Star, Heart, Send, Download } from "lucide-react";
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

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<Photo | null>(null);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commenterName, setCommenterName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const returnPath = new URLSearchParams(location.search).get("return") || `/gallery/${galleryId}`;

  useEffect(() => {
    const fetchGalleryData = async () => {
      try {
        // Check for stored password
        let storedPassword = null;
        try {
          storedPassword = localStorage.getItem(`gallery_access_${galleryId}`);
        } catch (error) {
          console.error('Error accessing localStorage:', error);
        }

        // Use POST with password if available, otherwise GET
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
          // Password required or invalid - redirect back to gallery
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
      navigate(`/gallery/${galleryId}/photo/${prevPhoto.id}?return=${encodeURIComponent(returnPath)}`);
    }
  };

  const handleNext = () => {
    if (!currentPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === currentPhoto.id);
    if (currentIndex < photos.length - 1) {
      const nextPhoto = photos[currentIndex + 1];
      navigate(`/gallery/${galleryId}/photo/${nextPhoto.id}?return=${encodeURIComponent(returnPath)}`);
    }
  };

  const handleRatingClick = async (rating: number) => {
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

  const handleCommentSubmit = async () => {
    if (!currentPhoto || !commentText.trim() || !commenterName.trim()) return;

    try {
      const response = await fetch(`/api/public/photos/${currentPhoto.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commenterName: commenterName.trim(), text: commentText.trim() }),
      });

      if (response.ok) {
        const newComment = {
          id: Date.now().toString(),
          author: commenterName.trim(),
          text: commentText.trim(),
          timestamp: new Date().toLocaleString('de-DE'),
        };
        setCurrentPhoto({
          ...currentPhoto,
          comments: [...currentPhoto.comments, newComment],
        });
        setCommentText("");
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

  const handleDownload = async () => {
    if (!currentPhoto) return;

    const loadingToast = toast({
      title: "Download wird vorbereitet",
      description: (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span>Das Foto wird vorbereitet...</span>
        </div>
      ),
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

  if (isLoading || !currentPhoto) {
    return <div className="flex items-center justify-center h-screen">Lädt...</div>;
  }

  const currentIndex = photos.findIndex(p => p.id === currentPhoto.id);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">{currentPhoto.alt}</h2>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 relative flex items-center justify-center bg-black/5 p-4">
          <img
            src={currentPhoto.mediumSrc || currentPhoto.src}
            alt={currentPhoto.alt}
            className="max-w-full max-h-full object-contain"
          />

          <Button
            variant="secondary"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2"
            onClick={handleNext}
            disabled={currentIndex === photos.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="w-full md:w-96 border-l flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Bewertung</h3>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <button onClick={() => handleRatingClick(0)} className="text-muted-foreground hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => handleRatingClick(star)}>
                      <Star className={`w-4 h-4 ${star <= currentPhoto.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{currentPhoto.rating} Sterne</p>
              </div>
            </div>

            <div>
              <Button variant="ghost" onClick={handleLikeToggle} className="w-full justify-start">
                <Heart className={`w-4 h-4 mr-2 ${currentPhoto.isLiked ? "fill-red-500 text-red-500" : ""}`} />
                {currentPhoto.isLiked ? "Geliked" : "Liken"}
              </Button>
            </div>

            {gallery?.allowDownload !== false && (
              <Button onClick={handleDownload} className="mb-4 w-full">
                <Download className="w-5 h-5 mr-2" />
                Bild herunterladen
              </Button>
            )}

            <div>
              <h3 className="font-semibold mb-2">Kommentare ({currentPhoto.comments.length})</h3>
              <div className="space-y-3 mb-4">
                {currentPhoto.comments.map((comment) => (
                  <Card key={comment.id} className="p-3">
                    <p className="font-medium text-sm">{comment.author}</p>
                    <p className="text-sm text-muted-foreground mt-1">{comment.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{comment.timestamp}</p>
                  </Card>
                ))}
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="Dein Name"
                  value={commenterName}
                  onChange={(e) => setCommenterName(e.target.value)}
                />
                <Textarea
                  placeholder="Schreibe einen Kommentar..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleCommentSubmit} className="w-full" disabled={!commentText.trim() || !commenterName.trim()}>
                  <Send className="w-4 h-4 mr-2" />
                  Kommentar senden
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
