import {
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Heart,
  Download,
  MessageCircle,
  Menu,
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
import { useState, useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

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

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

interface LightboxProps {
  photo: Photo | null;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onToggleLike: (photoId: string, userName?: string) => void;
  onRatingChange: (photoId: string, rating: number, userName?: string) => void;
  onAddComment: (
    photoId: string,
    comment: string,
    commenterName: string,
  ) => void;
}

export default function Lightbox({
  photo,
  onClose,
  onPrevious,
  onNext,
  onToggleLike,
  onRatingChange,
  onAddComment,
}: LightboxProps) {
  const [newComment, setNewComment] = useState("");
  const [commenterName, setCommenterName] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const isMobile = useIsMobile();

  // Auth optional
  let user = null;
  try {
    const { user: authUser } = useAuth();
    user = authUser;
  } catch (error) {}

  // Prevent body scroll
  useEffect(() => {
    if (photo) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [photo]);

  // Swipe state
  const touchStartX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    setIsAnimating(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    setOffsetX(deltaX);
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    const threshold = 80;
    setIsAnimating(true);

    if (offsetX < -threshold && onNext) {
      setOffsetX(-window.innerWidth);
      setTimeout(() => {
        setOffsetX(0);
        onNext();
        setIsAnimating(false);
      }, 200);
    } else if (offsetX > threshold && onPrevious) {
      setOffsetX(window.innerWidth);
      setTimeout(() => {
        setOffsetX(0);
        onPrevious();
        setIsAnimating(false);
      }, 200);
    } else {
      setOffsetX(0);
    }
  };

  if (!photo) return null;

  const handleSubmitComment = () => {
    if (newComment.trim() && commenterName.trim()) {
      onAddComment(photo.id, newComment.trim(), commenterName.trim());
      setNewComment("");
      setCommenterName("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSubmitComment();
    }
  };

  const handleDownloadPhoto = async () => {
    if (!photo) return;
    try {
      const downloadSrc = photo.originalSrc || photo.src;
      const response = await fetch(downloadSrc);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileName =
        photo.alt.replace(/[^a-z0-9]/gi, "_").toLowerCase() || photo.id;
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

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Mobile top bar */}
      {isMobile && (
        <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 z-50 bg-black/20 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setShowMobileSidebar(true);
            }}
          >
            <Menu className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white rounded-full"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div
        className={`relative ${isMobile ? "w-full h-full flex-col" : "max-w-7xl max-h-full w-full flex"} ${isMobile ? "bg-transparent" : "bg-background"} ${isMobile ? "rounded-none" : "rounded-lg"} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo area */}
        <div
          className={`flex-1 flex items-center justify-center ${isMobile ? "h-full pt-16 pb-20" : "p-8"}`}
        >
          {!isMobile && onPrevious && (
            <Button
              variant="ghost"
              className="mr-4 bg-black/10 hover:bg-black/40 h-16 w-16"
              onClick={onPrevious}
            >
              <ChevronLeft className="w-12 h-12" />
            </Button>
          )}

          {/* Swipeable Image */}
          <div
            className="flex items-center justify-center max-w-full max-h-full overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={photo.mediumSrc || photo.src}
              alt={photo.alt}
              className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out"
              style={{
                transform: `translateX(${offsetX}px)`,
                transition: isAnimating ? "transform 0.2s ease-out" : "none",
              }}
            />
          </div>

          {!isMobile && onNext && (
            <Button
              variant="ghost"
              className="ml-4 bg-black/10 hover:bg-black/40 h-16 w-16"
              onClick={onNext}
            >
              <ChevronRight className="w-12 h-12" />
            </Button>
          )}
        </div>

        {/* Sidebar Desktop */}
        {!isMobile && (
          <div className="w-80 bg-card border-l p-6 overflow-y-auto">
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <h3 className="font-semibold text-lg mb-2">{photo.alt}</h3>
            <div className="mb-4">
              <h4 className="font-medium mb-2">Rating</h4>
              <div className="flex items-center space-x-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => onRatingChange(photo.id, star, user?.name)}
                  >
                    <Star
                      className={`w-5 h-5 ${star <= photo.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {photo.rating} stars
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => onToggleLike(photo.id, user?.name)}
            >
              <Heart
                className={`w-5 h-5 ${photo.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
              />
              <span className="ml-2">
                {photo.isLiked ? "Gefällt mir" : "Gefällt mir nicht"}
              </span>
            </Button>
            <div className="mt-4">
              <Button onClick={handleDownloadPhoto}>
                <Download className="w-5 h-5 mr-2" />
                Bild herunterladen
              </Button>
            </div>
            <div className="mt-6">
              <h4 className="font-medium mb-4">
                Comments ({photo.comments.length})
              </h4>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {photo.comments.map((comment) => (
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
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || !commenterName.trim()}
                size="sm"
                className="mt-2"
              >
                Kommentar hinzufügen
              </Button>
            </div>
          </div>
        )}

        {/* Mobile Bottom Controls */}
        {isMobile && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t p-4 flex justify-between">
            <Button variant="ghost" size="icon" onClick={handleDownloadPhoto}>
              <Download className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onRatingChange(photo.id, star, user?.name)}
                >
                  <Star
                    className={`w-5 h-5 ${star <= photo.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleLike(photo.id, user?.name)}
            >
              <Heart
                className={`w-5 h-5 ${photo.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
              />
            </Button>
            <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MessageCircle className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>{photo.alt}</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4 overflow-y-auto h-full">
                  <h4 className="font-medium">
                    Comments ({photo.comments.length})
                  </h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {photo.comments.map((comment) => (
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
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                  <Textarea
                    placeholder="Kommentar hinzufügen..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={handleKeyPress}
                    rows={3}
                  />
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || !commenterName.trim()}
                    size="sm"
                  >
                    Kommentar hinzufügen
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
    </div>
  );
}
