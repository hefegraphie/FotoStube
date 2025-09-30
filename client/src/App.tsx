import React, { useState, useEffect, Suspense, lazy } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider, useNotifications } from "./contexts/NotificationContext";
import LoginForm from "./components/LoginForm";
import { Button } from "@/components/ui/button";
import { LogOut, Upload, ArrowLeft, Menu, Bell } from "lucide-react";

// Lazy load heavy components
const PhotoGallery = lazy(() => import("./components/PhotoGallery"));
const PhotoUpload = lazy(() => import("./components/PhotoUpload"));
const CollapsibleSelectionPanel = lazy(() => import("./components/CollapsibleSelectionPanel"));
const SubGalleries = lazy(() => import("./components/SubGalleries"));
const GalleriesOverviewComponent = lazy(() => import("./components/GalleriesOverview"));
const ThemeToggle = lazy(() => import("./components/ThemeToggle"));
const Breadcrumb = lazy(() => import("./components/Breadcrumb"));
const PublicGallery = lazy(() => import("./components/PublicGallery"));

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

  const handleSelectGallery = (galleryId: string) => {
    navigate(`/galleries/${galleryId}`);
  };

  return (
    <AuthWrapper>
      <Suspense fallback={<div className="flex justify-center items-center h-screen"><p>Lädt Gallerien...</p></div>}>
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

  // Query for current gallery data
  const { data: currentGalleryData } = useQuery({
    queryKey: ['gallery', galleryId],
    queryFn: async () => {
      const response = await fetch(`/api/galleries/${galleryId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch gallery');
      }
      return response.json();
    },
    enabled: !!galleryId,
  });

  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    showOnlyLiked: false,
    showOnlyRated: false,
    minStars: 0,
    maxStars: 5
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  if (!galleryId) {
    navigate('/galleries');
    return null;
  }

  // Fetch photos for the selected gallery from backend
  const { data: backendPhotos = [], isLoading: photosLoading, refetch } = useQuery({
    queryKey: ['/api/galleries', galleryId, 'photos', user?.id],
    enabled: !!galleryId && !!user?.id,
    queryFn: async () => {
      const response = await fetch(`/api/galleries/${galleryId}/photos?userId=${user!.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }
      return response.json();
    }
  });

  // Transform backend photos to match component interface
  const transformedPhotos = backendPhotos.map((photo: any) => ({
    id: photo.id,
    src: `/${photo.thumbnailPath || photo.filePath}`,
    mediumSrc: photo.mediumPath ? `/${photo.mediumPath}` : undefined,
    originalSrc: photo.filePath ? `/${photo.filePath}` : undefined,
    alt: photo.alt,
    rating: photo.rating || 0,
    isLiked: photo.isLiked || false,
    comments: photo.comments?.map((comment: any) => ({
      id: comment.id,
      author: comment.commenterName || comment.author,
      text: comment.text,
      timestamp: comment.timestamp || new Date(comment.createdAt).toLocaleString('de-DE')
    })) || []
  }));

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

  const handleClearSelection = () => {
    setSelectedPhotoIds(new Set());
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
        const photoNames = transformedPhotos.filter(p => photoIds.includes(p.id)).map(p => p.alt || p.id);
        const photoText = photoIds.length === 1 ? 'Foto' : 'Fotos';
        const starText = rating === 1 ? 'Stern' : 'Sterne';

        // Build gallery path
        const breadcrumbItems = getBreadcrumbItems();
        const galleryPath = breadcrumbItems.length > 1 
          ? ` in Galerie ${breadcrumbItems.slice(1).map(item => item.label).join(' > ')}`
          : '';

        if (user?.name) {
          addNotification(`${user.name} hat ${photoNames.join(', ')}${galleryPath} mit ${rating} ${starText} bewertet`, 'rating');
        } else {
          addNotification(`Jemand hat ${photoNames.join(', ')}${galleryPath} mit ${rating} ${starText} bewertet`, 'rating');
        }

        setSelectedPhotoIds(new Set());
        await queryClient.invalidateQueries({ queryKey: ['/api/galleries', galleryId, 'photos'] });
        alert(`${photoIds.length} Foto${photoIds.length > 1 ? 's' : ''} erfolgreich mit ${rating} Stern${rating > 1 ? 'en' : ''} bewertet`);
      } else {
        const errorData = await response.json();
        console.error('Batch rating failed:', errorData);
        alert('Fehler beim Bewerten der ausgewählten Fotos');
      }
    } catch (error) {
      console.error('Error setting batch rating:', error);
      alert('Fehler beim Bewerten der ausgewählten Fotos');
    }
  };

  const handleRemoveFromSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(photoId);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const filteredPhotos = transformedPhotos.filter(photo => {
      if (filters.showOnlyLiked && !photo.isLiked) {
        return false;
      }

      if (filters.showOnlyRated && (!photo.rating || photo.rating === 0)) {
        return false;
      }

      if (photo.rating && photo.rating >= filters.minStars && photo.rating <= filters.maxStars) {
        return true;
      } else if (!photo.rating && filters.minStars === 0) {
        return true;
      }
      return false;
    });

    const filteredPhotoIds = filteredPhotos.map(photo => photo.id);
    setSelectedPhotoIds(new Set(filteredPhotoIds));
  };

  const selectedPhotos = transformedPhotos.filter(photo => selectedPhotoIds.has(photo.id));

  const handleBackToGalleries = () => {
    navigate('/galleries');
  };

  const handleUploadComplete = () => {
    setShowUploadDialog(false);
    if (galleryId) {
      queryClient.invalidateQueries({ queryKey: ['gallery-preview', galleryId] });
      refetch(); // Refetch photos to show newly uploaded images immediately
    }
  };

  const handlePhotosChange = () => {
    if (galleryId) {
      queryClient.invalidateQueries({ queryKey: ['/api/galleries', galleryId, 'photos'] });
    }
  };

  const handleDeleteSelectedPhotos = async () => {
    const photoIds = Array.from(selectedPhotoIds);

    if (photoIds.length === 0) return;

    try {
      const response = await fetch('/api/photos/batch', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoIds
        }),
      });

      if (response.ok) {
        setSelectedPhotoIds(new Set());
        refetch();
      } else {
        console.error('Failed to delete photos');
      }
    } catch (error) {
      console.error('Error deleting photos:', error);
    }
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

        // Create download notification for selected photos
        if (currentGalleryData?.userId && user?.id) {
          try {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: currentGalleryData.userId,
                galleryId: currentGalleryData.id,
                type: 'download',
                message: `${user.name} hat ${selectedPhotoIds.size} Foto${selectedPhotoIds.size !== 1 ? 's' : ''} aus Galerie "${currentGalleryData.name}" heruntergeladen`,
                actorName: user.name,
                isRead: false
              })
            });
          } catch (error) {
            console.error('Error creating download notification:', error);
          }
        }

        // Clear selection after successful download
        setSelectedPhotoIds(new Set());
      } else {
        console.error('Failed to download photos');
      }
    } catch (error) {
      console.error('Error downloading photos:', error);
    }
  };

  const handleDownloadAllPhotos = async () => {
    const allPhotoIds = transformedPhotos.map(p => p.id);

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

        // Add notification with gallery context
        const userName = user?.name || 'Jemand';
        const photoCount = allPhotoIds.length;
        const photoText = photoCount === 1 ? 'Foto' : 'Fotos';

        // Build gallery path
        const breadcrumbItems = getBreadcrumbItems();
        const galleryPath = breadcrumbItems.length > 1 
          ? ` aus Galerie ${breadcrumbItems.slice(1).map(item => item.label).join(' > ')}`
          : '';

        addNotification(`${userName} hat alle ${photoCount} ${photoText}${galleryPath} heruntergeladen`, 'download');
      } else {
        console.error('Failed to download photos');
      }
    } catch (error) {
      console.error('Error downloading photos:', error);
    }
  };

  const getBreadcrumbItems = () => {
    const items = [
      { label: 'Gallerien', onClick: () => navigate('/galleries') },
    ];

    // Use currentGalleryData for current gallery, fallback to galleries array for parents
    const currentGallery = currentGalleryData || galleries.find(g => g.id === galleryId);
    const parentGallery = parentId ? galleries.find(g => g.id === parentId) : null;
    const grandParentGallery = grandParentId ? galleries.find(g => g.id === grandParentId) : null;

    if (grandParentGallery) {
      items.push({
        label: grandParentGallery.name,
        onClick: () => navigate(`/galleries/${grandParentId}`),
      });
    }

    if (parentGallery) {
      items.push({
        label: parentGallery.name,
        onClick: () => navigate(grandParentGallery ? `/galleries/${grandParentId}/${parentId}` : `/galleries/${parentId}`),
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
    const gallery = currentGalleryData || galleries?.find(g => g.id === galleryId);
    return gallery?.name || "Unbekannte Galerie";
  };

  return (
    <AuthWrapper>
      <Suspense fallback={<div className="flex justify-center items-center h-screen"><p>Lädt Galerie...</p></div>}>
        <div className="flex flex-col md:flex-row h-screen">
          {/* Main Content */}
          <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold mb-2" data-testid="text-gallery-title">
                  {getCurrentGalleryName()}
                </h1>
                <Breadcrumb items={getBreadcrumbItems()} />
              </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setShowUploadDialog(true)} className="btn-green" data-testid="button-upload-photos">
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
                  const event = new CustomEvent('toggleSelectionPanel');
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
              queryClient.invalidateQueries({ queryKey: ['gallery-preview', galleryId] });
            }}
          />

          {/* Sub-Galleries */}
          <SubGalleries
            parentGalleryId={galleryId}
            onSelectSubGallery={(subGalleryId) => {
              const currentGallery = galleries.find(g => g.id === galleryId);
              if (currentGallery?.parentId) {
                // We're in a sub-gallery, navigate to sub-sub-gallery
                navigate(`/galleries/${grandParentId}/${parentId}/${subGalleryId}`);
              } else {
                // We're in a main gallery, navigate to sub-gallery
                navigate(`/galleries/${galleryId}/${subGalleryId}`);
              }
            }}
            isSubGallery={!!parentId || !!grandParentId}
          />

          {/* Photo Gallery */}
          <PhotoGallery
            photos={transformedPhotos}
            selectedPhotoIds={selectedPhotoIds}
            onToggleSelection={handleToggleSelection}
            onPhotosChange={handlePhotosChange}
            authContext={{ user }}
            filters={filters}
            galleryContext={{
              currentGallery: getCurrentGalleryName(),
              parentGallery: parentId ? galleries.find(g => g.id === parentId)?.name : undefined,
              grandParentGallery: grandParentId ? galleries.find(g => g.id === grandParentId)?.name : undefined,
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
        {/* Public gallery route - outside AuthProvider */}
        <Route path="/gallery/:galleryId" element={<PublicGallery />} />
        {/* Main authenticated app - wrapped with AuthProvider */}
        <Route path="/*" element={
          <AuthProvider>
            <NotificationProvider>
              <Routes>
                <Route path="/" element={<GalleriesOverview />} />
                <Route path="/galleries" element={<GalleriesOverview />} />
                <Route path="/galleries/:galleryId" element={<GalleryView />} />
                <Route path="/galleries/:parentId/:galleryId" element={<GalleryView />} />
                <Route path="/galleries/:grandParentId/:parentId/:galleryId" element={<GalleryView />} />
              </Routes>
            </NotificationProvider>
          </AuthProvider>
        } />
      </Routes>
    </TooltipProvider>
  );
}

export default App;