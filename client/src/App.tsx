import React, { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, useParams, useNavigate, Navigate, useLocation } from "react-router-dom";
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
import { LogOut, Upload, ArrowLeft, Menu, Bell, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LoadingOverlay from "./components/LoadingOverlay";
import InitialSetup from "@/components/InitialSetup";

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
const Settings = lazy(() => import("./components/Settings"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));
const GalleryNotFound = lazy(() => import("./components/GalleryNotFound"));
const AssignmentsPage = lazy(() => import("./components/AssignmentsPage"));

// New component for public lightbox page
const PublicLightboxPage = lazy(() => import("./components/PublicLightboxPage"));

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
  const { user } = useAuth();
  const { addNotification } = useNotifications(); // Use addNotification
  const { setPhotos } = usePhotos(); // Get setPhotos from context
  const [showSettings, setShowSettings] = useState(false); // State to control settings view

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
        {showSettings ? (
          <Settings onBack={() => setShowSettings(false)} />
        ) : (
          <GalleriesOverviewComponent
            onSelectGallery={handleSelectGallery}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </Suspense>
    </AuthWrapper>
  );
}

// Component for showing individual gallery
function GalleryView() {
  const { galleryId: currentGalleryId, parentId, grandParentId } = useParams<{
    galleryId: string;
    parentId?: string;
    grandParentId?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, galleries } = useAuth();


  const queryClient = useQueryClient();
  const { addNotification } = useNotifications(); // Use addNotification
  const {
    photos: sharedPhotos,
    setPhotos: setSharedPhotos,
    updatePhotoRating,
    updatePhotoLike,
    addPhotoComment,
    selectedPhotoIds,
    setSelectedPhotoIds,
    togglePhotoSelection,
    clearSelection,
  } = usePhotos(); // Use context for photos
  const { toast } = useToast();

  // State for loading overlay during batch rating
  const [isBatchRating, setIsBatchRating] = useState(false);

  // Query for current gallery data
  const { data: currentGalleryData, isError: galleryError, error: galleryErrorData } = useQuery({
    queryKey: ["gallery", currentGalleryId],
    queryFn: async () => {
      const response = await fetch(`/api/galleries/${currentGalleryId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch gallery");
      }
      return response.json();
    },
    enabled: !!currentGalleryId,
    retry: false, // Don't retry on error
  });

  const [filters, setFilters] = useState<FilterState>({
    showOnlyLiked: false,
    showOnlyRated: false,
    minStars: 0,
    maxStars: 5,
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(
    null,
  );

  // Fetch photos for the selected gallery from backend
  const {
    data: backendPhotos = [],
    isLoading: photosLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/galleries", currentGalleryId, "photos", user?.id],
    enabled: !!currentGalleryId && !!user?.id,
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `/api/galleries/${currentGalleryId}/photos`,
        {
          credentials: 'include',
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        }
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
    togglePhotoSelection(photoId);
  };

  const handleClearSelection = () => {
    clearSelection();
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
          userName: user?.name
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
    togglePhotoSelection(photoId); // Use context function
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
    // Add all filtered photos to selection (merge with existing selection)
    setSelectedPhotoIds(new Set([...selectedPhotoIds, ...filteredPhotoIds]));
  };

  const selectedPhotos = transformedPhotos.filter((photo) =>
    selectedPhotoIds.has(photo.id),
  );

  const handleBackToGalleries = () => {
    setSelectedGalleryId(null); // Reset selected gallery to go back to overview
  };

  const handleUploadComplete = () => {
    setShowUploadDialog(false);
    if (currentGalleryId) {
      queryClient.invalidateQueries({
        queryKey: ["gallery-preview", currentGalleryId],
      });
      refetch(); // Refetch photos to show newly uploaded images immediately
    }
  };

  const handlePhotosChange = () => {
    if (currentGalleryId) {
      queryClient.invalidateQueries({
        queryKey: ["/api/galleries", currentGalleryId, "photos"],
      });
    }
  };

  const handleDeleteSelectedPhotos = async () => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/photos/batch', {
        method: "DELETE",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          photoIds,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Batch delete result:", result);

        // Clear selection first
        clearSelection();

        // Force reload photos from server
        const galleryId = currentGalleryId || location.pathname.split("/galleries/")[1]?.split("/")[0];
        if (galleryId) {
          try {
            const photosResponse = await fetch(`/api/galleries/${galleryId}/photos`);
            if (photosResponse.ok) {
              const backendPhotos = await photosResponse.json();
              const transformedPhotos = backendPhotos.map((photo: any) => ({
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
              setSharedPhotos(transformedPhotos);
            }
          } catch (error) {
            console.error("Error reloading photos:", error);
          }
        }

        toast({
          title: "Fotos gelöscht",
          description: `${result.deleted?.length || 0} Foto${result.deleted?.length > 1 ? "s" : ""} erfolgreich gelöscht`,
        });
      } else {
        console.error("Failed to delete photos");
        toast({
          title: "Löschen fehlgeschlagen",
          description: "Einige Fotos konnten nicht gelöscht werden.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting photos:", error);
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSelectedPhotos = async () => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    // Show preparation indicator using toast
    const loadingToast = toast({
      title: "Download wird vorbereitet...",
      description: "Die Anfrage wird an den Server gesendet.",
      duration: Infinity,
    });

    try {
      // Step 1: Request download token
      const response = await fetch("/api/photos/prepare-download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoIds: photoIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Step 2: Let browser handle download natively
        window.location.href = data.downloadUrl;

        loadingToast.dismiss();

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

        toast({
          title: "Download gestartet",
          description: `Der Browser lädt ${photoIds.length} Foto${photoIds.length !== 1 ? "s" : ""} herunter.`,
          duration: 3000,
        });
      } else {
        loadingToast.dismiss();
        console.error("Failed to prepare download");
        toast({
          title: "Download fehlgeschlagen",
          description: "Es gab ein Problem beim Vorbereiten des Downloads.",
          variant: "destructive",
        });
      }
    } catch (error) {
      loadingToast.dismiss();
      console.error("Error preparing download:", error);
      toast({
        title: "Download fehlgeschlagen",
        description: "Es gab ein Problem beim Vorbereiten des Downloads.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAllPhotos = async () => {
    const allPhotoIds = transformedPhotos.map((p) => p.id);

    if (allPhotoIds.length === 0) return;

    // Show preparation indicator using toast
    const loadingToast = toast({
      title: "Download wird vorbereitet...",
      description: "Die Anfrage wird an den Server gesendet.",
      duration: Infinity,
    });

    try {
      // Step 1: Request download token
      const response = await fetch("/api/photos/prepare-download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoIds: allPhotoIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Step 2: Let browser handle download natively
        window.location.href = data.downloadUrl;

        loadingToast.dismiss();

        toast({
          title: "Download gestartet",
          description: `Der Browser lädt alle ${allPhotoIds.length} Fotos herunter.`,
          duration: 3000,
        });
      } else {
        loadingToast.dismiss();
        console.error("Failed to prepare download");
        toast({
          title: "Download fehlgeschlagen",
          description: "Es gab ein Problem beim Vorbereiten des Downloads.",
          variant: "destructive",
        });
      }
    } catch (error) {
      loadingToast.dismiss();
      console.error("Error preparing download:", error);
      toast({
        title: "Download fehlgeschlagen",
        description: "Es gab ein Problem beim Vorbereiten des Downloads.",
        variant: "destructive",
      });
    }
  };

  const getBreadcrumbItems = () => {
    const items = [
      { label: "Gallerien", onClick: () => {
        handleClearSelection();
        navigate("/galleries");
      }},
    ];

    // Use currentGalleryData for current gallery, fallback to galleries array for parents
    const currentGallery =
      currentGalleryData || galleries.find((g) => g.id === currentGalleryId);
    const parentGallery = parentId
      ? galleries.find((g) => g.id === parentId)
      : null;
    const grandParentGallery = grandParentId
      ? galleries.find((g) => g.id === grandParentId)
      : null;

    if (grandParentGallery) {
      items.push({
        label: grandParentGallery.name,
        onClick: () => {
          handleClearSelection();
          navigate(`/galleries/${grandParentId}`);
        },
      });
    }

    if (parentGallery) {
      items.push({
        label: parentGallery.name,
        onClick: () => {
          handleClearSelection();
          navigate(
            grandParentGallery
              ? `/galleries/${grandParentId}/${parentId}`
              : `/galleries/${parentId}`,
          );
        },
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
    if (!currentGalleryId) return "";
    const gallery =
      currentGalleryData || galleries?.find((g) => g.id === currentGalleryId);
    return gallery?.name || "Unbekannte Galerie";
  };

  // Fetch branding settings
  const { data: brandingData } = useQuery({
    queryKey: ["/api/branding"],
    queryFn: async () => {
      const response = await fetch("/api/branding");
      if (!response.ok) return { companyName: "PhotoGallery" };
      return response.json();
    },
  });

  const companyName = brandingData?.companyName || "PhotoGallery";

  // Set page title based on current gallery
  useEffect(() => {
    const galleryName = getCurrentGalleryName();
    if (galleryName) {
      document.title = `${galleryName} - ${companyName}`;
    }
  }, [currentGalleryId, currentGalleryData, companyName]);

  // Early returns AFTER all hooks
  if (!currentGalleryId) {
    navigate("/galleries");
    return null;
  }

  // Show 404 page if gallery not found or access denied
  if (galleryError) {
    return (
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <p>Lädt...</p>
        </div>
      }>
        <GalleryNotFound />
      </Suspense>
    );
  }

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
                {(user?.role === "Admin" || user?.role === "Creator") && (
                  <Button
                    onClick={() => setShowUploadDialog(true)}
                    className="btn-green"
                    data-testid="button-upload-photos"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Fotos hochladen
                  </Button>
                )}


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
              galleryId={currentGalleryId}
              onUploadComplete={() => {
                refetch();
                queryClient.invalidateQueries({
                  queryKey: ["gallery-preview", currentGalleryId],
                });
              }}
            />

            {/* Sub-Galleries */}
            <SubGalleries
              parentGalleryId={currentGalleryId}
              onSelectSubGallery={(subGalleryId) => {
                const currentGallery = galleries.find(
                  (g) => g.id === currentGalleryId,
                );
                if (currentGallery?.parentId) {
                  // We're in a sub-gallery, navigate to sub-sub-gallery
                  navigate(
                    `/galleries/${grandParentId}/${parentId}/${subGalleryId}`,
                  );
                } else {
                  // We're in a main gallery, navigate to sub-gallery
                  navigate(`/galleries/${currentGalleryId}/${subGalleryId}`);
                }
              }}
              isSubGallery={!!parentId || !!grandParentId}
              onClearSelection={handleClearSelection}
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
            galleryId={currentGalleryId}
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
          path="/public/:galleryId"
          element={
            <NotificationProvider>
              <PhotoProvider>
                <PublicGallery />
              </PhotoProvider>
            </NotificationProvider>
          }
        />
        <Route
          path="/public/:galleryId/photo/:photoId"
          element={
            <NotificationProvider>
              <PhotoProvider>
                <PublicLightboxPage />
              </PhotoProvider>
            </NotificationProvider>
          }
        />
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
                <PublicLightboxPage />
              </PhotoProvider>
            </NotificationProvider>
          }
        />
        <Route
          path="/gallery/:parentId/:galleryId"
          element={
            <NotificationProvider>
              <PhotoProvider>
                <PublicGallery />
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
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/setup" element={<InitialSetup />} />
                    <Route path="/login" element={<LoginForm />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/galleries" element={<GalleriesOverview />} />
                    <Route path="/assignments" element={
                      <Suspense fallback={
                        <div className="flex justify-center items-center h-screen">
                          <p>Lädt...</p>
                        </div>
                      }>
                        <AssignmentsPage />
                      </Suspense>
                    } />
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