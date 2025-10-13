import React, { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "./contexts/AuthContext";
import {
  NotificationProvider,
  useNotifications,
} from "./contexts/NotificationContext";
import { PhotoProvider, usePhotos } from "./contexts/PhotoContext";
import LoginForm from "./components/LoginForm";
import { Button } from "@/components/ui/button";
import { LogOut, Upload, ArrowLeft, Menu, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LoadingOverlay from "./components/LoadingOverlay";

// Lazy load heavy components
const PhotoGallery = lazy(() => import("./components/PhotoGallery"));
const PhotoUpload = lazy(() => import("./components/PhotoUpload"));
const CollapsibleSelectionPanel = lazy(
  () => import("./components/CollapsibleSelectionPanel"),
);
const SubGalleries = lazy(() => import("./components/SubGalleries"));
const GalleriesOverviewComponent = lazy(
  () => import("./components/GalleriesOverview"),
);
const ThemeToggle = lazy(() => import("./components/ThemeToggle"));
const Breadcrumb = lazy(() => import("./components/Breadcrumb"));
const PublicGallery = lazy(() => import("./components/PublicGallery"));
const LightboxPage = lazy(() => import("./components/LightboxPage"));

interface Photo {
  id: string;
  src: string;
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

// Define the FilterState interface
interface FilterState {
  showOnlyLiked: boolean;
  showOnlyRated: boolean;
  minStars: number;
  maxStars: number;
}

// Wrapper to ensure auth context is ready
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Give auth context time to initialize
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Lädt...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
}

// Component for showing the galleries overview
function GalleriesOverview() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications(); // Use addNotification
  const { setPhotos } = usePhotos(); // Get setPhotos from context

  // Clear photos when entering galleries overview
  useEffect(() => {
    setPhotos([]);
  }, [setPhotos]);
  const handleSelectGallery = (galleryId: string) => {
    navigate(`/galleries/${galleryId}`);
  };

  return (
    <AuthWrapper>
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <p>Lädt Gallerien...</p>
          </div>
        }
      >
        <GalleriesOverviewComponent onSelectGallery={handleSelectGallery} />
      </Suspense>
    </AuthWrapper>
  );
}

// Component for showing individual gallery
function GalleryView() {
  const { galleryId, parentId, grandParentId } = useParams<{
    galleryId: string;
    parentId?: string;
    grandParentId?: string;
  }>();
  const navigate = useNavigate();
  const { user, galleries } = useAuth();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications(); // Use addNotification
  const { photos: sharedPhotos, setPhotos: setSharedPhotos } = usePhotos(); // Use context for photos
  const { toast } = useToast();

  // State for loading overlay during batch rating
  const [isBatchRating, setIsBatchRating] = useState(false);

  // Query for current gallery data
  const { data: currentGalleryData } = useQuery({
    queryKey: ["gallery", galleryId],
    queryFn: async () => {
      const response = await fetch(`/api/galleries/${galleryId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch gallery");
      }
      return response.json();
    },
    enabled: !!galleryId,
  });

  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(
    new Set(),
  );
  const [filters, setFilters] = useState<FilterState>({
    showOnlyLiked: false,
    showOnlyRated: false,
    minStars: 0,
    maxStars: 5,
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  if (!galleryId) {
    navigate("/galleries");
    return null;
  }

  // Fetch photos for the selected gallery from backend
  const {
    data: backendPhotos = [],
    isLoading: photosLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/galleries", galleryId, "photos", user?.id],
    enabled: !!galleryId && !!user?.id,
    queryFn: async () => {
      const response = await fetch(
        `/api/galleries/${galleryId}/photos?userId=${user!.id}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch photos");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (!backendPhotos || backendPhotos.length === 0) return; // Kein Overwrite bei leerem Backend

    // Backend Photos transformieren
    const transformedBackendPhotos = backendPhotos.map((photo: any) => ({
      id: photo.id,
      src: `/${photo.thumbnailPath || photo.filePath}`,
      mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : undefined,
      originalSrc: photo.filePath ? `/${photo.filePath}` : undefined,
      alt: photo.alt,
      rating: photo.rating || 0,
      isLiked: photo.isLiked || false,
      comments:
        photo.comments?.map((comment: any) => ({
          id: comment.id,
          author: comment.commenterName || comment.author,
          text: comment.text,
          timestamp:
            comment.timestamp ||
            new Date(comment.createdAt).toLocaleString("de-DE"),
        })) || [],
    }));

    // Photo-IDs vergleichen
    const currentPhotoIds = sharedPhotos.map((photo) => photo.id).sort();
    const backendPhotoIds = transformedBackendPhotos
      .map((photo) => photo.id)
      .sort();
    const photosChanged =
      currentPhotoIds.length !== backendPhotoIds.length ||
      !currentPhotoIds.every((id, index) => id === backendPhotoIds[index]);

    // Nur wenn Context leer oder IDs anders sind, setzen!
    if (sharedPhotos.length === 0 || photosChanged) {
      setSharedPhotos(transformedBackendPhotos);
    }
    // sharedPhotos bleibt im Dependency Array absichtlich draußen!
  }, [backendPhotos, setSharedPhotos]);

  // Transform backend photos for context
  const transformedBackendPhotos = backendPhotos.map((photo: any) => ({
    id: photo.id,
    src: `/${photo.thumbnailPath || photo.filePath}`,
    mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : undefined,
    originalSrc: photo.filePath ? `/${photo.filePath}` : undefined,
    alt: photo.alt,
    rating: photo.rating || 0,
    isLiked: photo.isLiked || false,
    comments:
      photo.comments?.map((comment: any) => ({
        id: comment.id,
        author: comment.commenterName || comment.author,
        text: comment.text,
        timestamp:
          comment.timestamp ||
          new Date(comment.createdAt).toLocaleString("de-DE"),
      })) || [],
  }));

  const transformedPhotos = sharedPhotos; // Use photos from context

  const handleToggleSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedPhotoIds(new Set());
  };

  const handleBatchRatingChange = async (rating: number) => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    // Show loading overlay
    setIsBatchRating(true);

    // Store original ratings for rollback
    const originalRatings = new Map();
    photoIds.forEach((photoId) => {
      const photo = sharedPhotos.find((p) => p.id === photoId);
      if (photo) {
        originalRatings.set(photoId, photo.rating);
      }
    });

    // Optimistically update all photos in shared context
    const optimisticPhotos = sharedPhotos.map((photo) => {
      if (photoIds.includes(photo.id)) {
        return { ...photo, rating };
      }
      return photo;
    });
    setSharedPhotos(optimisticPhotos);

    try {
      const response = await fetch("/api/photos/batch/rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoIds,
          rating,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const updatedPhotos = result.photos || [];

        // Update with server response to ensure consistency
        const finalPhotos = sharedPhotos.map((photo) => {
          const updatedPhoto = updatedPhotos.find(
            (up: any) => up.id === photo.id,
          );
          return updatedPhoto
            ? { ...photo, rating: updatedPhoto.rating }
            : photo;
        });
        setSharedPhotos(finalPhotos);

        toast({
          title: "Bewertung erfolgreich",
          description: `${photoIds.length} Foto${photoIds.length > 1 ? "s" : ""} mit ${rating} Stern${rating > 1 ? "en" : ""} bewertet`,
        });
      } else {
        // Revert optimistic updates on error
        const revertedPhotos = sharedPhotos.map((photo) => {
          if (originalRatings.has(photo.id)) {
            return { ...photo, rating: originalRatings.get(photo.id) };
          }
          return photo;
        });
        setSharedPhotos(revertedPhotos);

        const errorData = await response.json();
        console.error("Batch rating failed:", errorData);
        toast({
          title: "Bewertung fehlgeschlagen",
          description: "Fehler beim Bewerten der ausgewählten Fotos.",
          variant: "destructive",
        });
      }
    } catch (error) {
      // Revert optimistic updates on error
      const revertedPhotos = sharedPhotos.map((photo) => {
        if (originalRatings.has(photo.id)) {
          return { ...photo, rating: originalRatings.get(photo.id) };
        }
        return photo;
      });
      setSharedPhotos(revertedPhotos);

      console.error("Error setting batch rating:", error);
      toast({
        title: "Bewertung fehlgeschlagen",
        description: "Es gab ein Problem beim Bewerten der ausgewählten Fotos.",
        variant: "destructive",
      });
    } finally {
      // Hide loading overlay
      setIsBatchRating(false);
    }
  };

  const handleRemoveFromSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(photoId);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const filteredPhotos = transformedPhotos.filter((photo) => {
      if (filters.showOnlyLiked && !photo.isLiked) {
        return false;
      }

      if (filters.showOnlyRated && (!photo.rating || photo.rating === 0)) {
        return false;
      }

      if (
        photo.rating &&
        photo.rating >= filters.minStars &&
        photo.rating <= filters.maxStars
      ) {
        return true;
      } else if (!photo.rating && filters.minStars === 0) {
        return true;
      }
      return false;
    });

    const filteredPhotoIds = filteredPhotos.map((photo) => photo.id);
    setSelectedPhotoIds(new Set(filteredPhotoIds));
  };

  const selectedPhotos = transformedPhotos.filter((photo) =>
    selectedPhotoIds.has(photo.id),
  );

  const handleBackToGalleries = () => {
    navigate("/galleries");
  };

  const handleUploadComplete = () => {
    setShowUploadDialog(false);
    if (galleryId) {
      queryClient.invalidateQueries({
        queryKey: ["gallery-preview", galleryId],
      });
      refetch(); // Refetch photos to show newly uploaded images immediately
    }
  };

  const handlePhotosChange = () => {
    if (galleryId) {
      queryClient.invalidateQueries({
        queryKey: ["/api/galleries", galleryId, "photos"],
      });
    }
  };

  const handleDeleteSelectedPhotos = async () => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    try {
      const response = await fetch("/api/photos/batch", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoIds,
        }),
      });

      if (response.ok) {
        setSelectedPhotoIds(new Set());
        refetch();
      } else {
        console.error("Failed to delete photos");
      }
    } catch (error) {
      console.error("Error deleting photos:", error);
    }
  };

  const handleDownloadSelectedPhotos = async () => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    // Show preparation indicator using toast with loading animation
    const loadingToast = toast({
      title: "Download wird vorbereitet...",
      description: (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span>
            {photoIds.length} Foto{photoIds.length !== 1 ? "s" : ""} werden
            vorbereitet. Dies kann einige Sekunden dauern...
          </span>
        </div>
      ),
      duration: Infinity, // Keep showing until manually dismissed
    });

    try {
      const response = await fetch("/api/photos/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoIds: photoIds,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `photos_${new Date().toISOString().split("T")[0]}.zip`;
        document.body.appendChild(a);

        // Dismiss loading toast only when download dialog appears
        loadingToast.dismiss();
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Create download notification for selected photos
        if (currentGalleryData?.userId && user?.id) {
          try {
            await fetch("/api/notifications", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: currentGalleryData.userId,
                galleryId: currentGalleryData.id,
                type: "download",
                message: `${user.name} hat ${selectedPhotoIds.size} Foto${selectedPhotoIds.size !== 1 ? "s" : ""} aus Galerie "${currentGalleryData.name}" heruntergeladen`,
                actorName: user.name,
                isRead: false,
              }),
            });
          } catch (error) {
            console.error("Error creating download notification:", error);
          }
        }

        // Show completion notification using toast
        toast({
          title: "Download abgeschlossen",
          description: `${photoIds.length} Foto${photoIds.length !== 1 ? "s" : ""} erfolgreich heruntergeladen.`,
          duration: 5000,
        });

        // Clear selection after successful download
      } else {
        loadingToast.dismiss();
        console.error("Failed to download photos");
        toast({
          title: "Download fehlgeschlagen",
          description: "Es gab ein Problem beim Herunterladen der Fotos.",
          variant: "destructive",
        });
      }
    } catch (error) {
      loadingToast.dismiss();
      console.error("Error downloading photos:", error);
      toast({
        title: "Download fehlgeschlagen",
        description: "Es gab ein Problem beim Herunterladen der Fotos.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAllPhotos = async () => {
    const allPhotoIds = transformedPhotos.map((p) => p.id);

    if (allPhotoIds.length === 0) return;

    // Show preparation indicator using toast with loading animation
    const loadingToast = toast({
      title: "Download wird vorbereitet...",
      description: (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span>
            Alle {allPhotoIds.length} Fotos werden vorbereitet. Dies kann einige
            Sekunden dauern...
          </span>
        </div>
      ),
      duration: Infinity, // Keep showing until manually dismissed
    });

    try {
      const response = await fetch("/api/photos/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoIds: allPhotoIds,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `photos_${new Date().toISOString().split("T")[0]}.zip`;
        document.body.appendChild(a);

        // Dismiss loading toast only when download dialog appears
        loadingToast.dismiss();
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Show completion notification using toast
        toast({
          title: "Download abgeschlossen",
          description: `Alle ${allPhotoIds.length} Fotos erfolgreich heruntergeladen.`,
          duration: 5000,
        });
      } else {
        loadingToast.dismiss();
        console.error("Failed to download photos");
        toast({
          title: "Download fehlgeschlagen",
          description: "Es gab ein Problem beim Herunterladen der Fotos.",
          variant: "destructive",
        });
      }
    } catch (error) {
      loadingToast.dismiss();
      console.error("Error downloading photos:", error);
      toast({
        title: "Download fehlgeschlagen",
        description: "Es gab ein Problem beim Herunterladen der Fotos.",
        variant: "destructive",
      });
    }
  };

  const getBreadcrumbItems = () => {
    const items = [
      { label: "Gallerien", onClick: () => navigate("/galleries") },
    ];

    // Use currentGalleryData for current gallery, fallback to galleries array for parents
    const currentGallery =
      currentGalleryData || galleries.find((g) => g.id === galleryId);
    const parentGallery = parentId
      ? galleries.find((g) => g.id === parentId)
      : null;
    const grandParentGallery = grandParentId
      ? galleries.find((g) => g.id === grandParentId)
      : null;

    if (grandParentGallery) {
      items.push({
        label: grandParentGallery.name,
        onClick: () => navigate(`/galleries/${grandParentId}`),
      });
    }

    if (parentGallery) {
      items.push({
        label: parentGallery.name,
        onClick: () =>
          navigate(
            grandParentGallery
              ? `/galleries/${grandParentId}/${parentId}`
              : `/galleries/${parentId}`,
          ),
      });
    }

    // Add current gallery as the last (non-clickable) item
    if (currentGallery) {
      items.push({
        label: currentGallery.name,
        onClick: () => {}, // Empty function since this is the current page
      });
    }

    return items;
  };

  const getCurrentGalleryName = () => {
    if (!galleryId) return "";
    const gallery =
      currentGalleryData || galleries?.find((g) => g.id === galleryId);
    return gallery?.name || "Unbekannte Galerie";
  };

  return (
    <AuthWrapper>
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <p>Lädt Galerie...</p>
          </div>
        }
      >
        <div className="flex flex-col md:flex-row h-screen">
          {/* Loading Overlay */}
          <LoadingOverlay isVisible={isBatchRating} message="Bilder werden bewertet..." />

          {/* Main Content */}
          <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1
                  className="text-2xl md:text-3xl font-semibold mb-2"
                  data-testid="text-gallery-title"
                >
                  {getCurrentGalleryName()}
                </h1>
                <Breadcrumb items={getBreadcrumbItems()} />
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  className="btn-green"
                  data-testid="button-upload-photos"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Fotos hochladen
                </Button>
                {/* Selection Panel Toggle Button - Mobile only */}
                <Button
                  variant="default"
                  size="icon"
                  className="md:hidden shadow-lg bg-primary hover:bg-primary/90"
                  onClick={() => {
                    // Trigger the CollapsibleSelectionPanel to open
                    const event = new CustomEvent("toggleSelectionPanel");
                    window.dispatchEvent(event);
                  }}
                  data-testid="toggle-selection-panel"
                >
                  <Menu className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <PhotoUpload
              isOpen={showUploadDialog}
              onClose={() => setShowUploadDialog(false)}
              galleryId={galleryId}
              onUploadComplete={() => {
                refetch();
                queryClient.invalidateQueries({
                  queryKey: ["gallery-preview", galleryId],
                });
              }}
            />

            {/* Sub-Galleries */}
            <SubGalleries
              parentGalleryId={galleryId}
              onSelectSubGallery={(subGalleryId) => {
                const currentGallery = galleries.find(
                  (g) => g.id === galleryId,
                );
                if (currentGallery?.parentId) {
                  // We're in a sub-gallery, navigate to sub-sub-gallery
                  navigate(
                    `/galleries/${grandParentId}/${parentId}/${subGalleryId}`,
                  );
                } else {
                  // We're in a main gallery, navigate to sub-gallery
                  navigate(`/galleries/${galleryId}/${subGalleryId}`);
                }
              }}
              isSubGallery={!!parentId || !!grandParentId}
            />

            {/* Photo Gallery */}
            <PhotoGallery
              photos={[]} // Empty array - component should use shared context
              selectedPhotoIds={selectedPhotoIds}
              onToggleSelection={handleToggleSelection}
              onPhotosChange={handlePhotosChange}
              filters={filters}
              galleryContext={{
                currentGallery: getCurrentGalleryName(),
                parentGallery: parentId
                  ? galleries.find((g) => g.id === parentId)?.name
                  : undefined,
                grandParentGallery: grandParentId
                  ? galleries.find((g) => g.id === grandParentId)?.name
                  : undefined,
              }}
            />
          </div>

          {/* Upload Dialog */}
          <PhotoUpload
            isOpen={showUploadDialog}
            onClose={() => setShowUploadDialog(false)}
            galleryId={galleryId}
            onUploadComplete={handleUploadComplete}
          />

          {/* Collapsible Selection Panel */}
          <CollapsibleSelectionPanel
            selectedPhotos={selectedPhotos}
            onClearSelection={handleClearSelection}
            onRatingChange={handleBatchRatingChange}
            onRemoveFromSelection={handleRemoveFromSelection}
            onDeleteSelected={handleDeleteSelectedPhotos}
            onSelectAll={handleSelectAll}
            filters={filters}
            onFiltersChange={setFilters}
            showFilters={true}
            onDownloadSelected={handleDownloadSelectedPhotos}
            onDownloadAll={handleDownloadAllPhotos}
          />
        </div>
      </Suspense>
    </AuthWrapper>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Routes>
        {/* Public gallery routes - outside AuthProvider but with PhotoProvider */}
        <Route
          path="/gallery/:galleryId"
          element={
            <NotificationProvider>
              <PhotoProvider>
                <PublicGallery />
              </PhotoProvider>
            </NotificationProvider>
          }
        />
        <Route
          path="/gallery/:galleryId/photo/:photoId"
          element={
            <NotificationProvider>
              <PhotoProvider>
                <LightboxPage />
              </PhotoProvider>
            </NotificationProvider>
          }
        />
        {/* Main authenticated app - wrapped with AuthProvider */}
        <Route
          path="/*"
          element={
            <AuthProvider>
              <NotificationProvider>
                <PhotoProvider>
                  <Routes>
                    <Route path="/" element={<GalleriesOverview />} />
                    <Route path="/galleries" element={<GalleriesOverview />} />
                    <Route
                      path="/galleries/:galleryId"
                      element={<GalleryView />}
                    />
                    <Route
                      path="/galleries/:parentId/:galleryId"
                      element={<GalleryView />}
                    />
                    <Route
                      path="/galleries/:grandParentId/:parentId/:galleryId"
                      element={<GalleryView />}
                    />
                    <Route
                      path="/galleries/:galleryId/photo/:photoId"
                      element={<LightboxPage />}
                    />
                    <Route
                      path="/galleries/:parentId/:galleryId/photo/:photoId"
                      element={<LightboxPage />}
                    />
                    <Route
                      path="/galleries/:grandParentId/:parentId/:galleryId/photo/:photoId"
                      element={<LightboxPage />}
                    />
                  </Routes>
                </PhotoProvider>
              </NotificationProvider>
            </AuthProvider>
          }
        />
      </Routes>
    </TooltipProvider>
  );
}

export default App;