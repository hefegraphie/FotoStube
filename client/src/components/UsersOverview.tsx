import {
  Calendar,
  ArrowUpDown,
  Image,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, lazy, Suspense } from "react";
import ThemeToggle from "./ThemeToggle";
import { LogOut } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import { usePhotos } from "@/contexts/PhotoContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const Settings = lazy(() => import("./Settings"));

interface GalleryPreview {
  id: string;
  src: string;
  alt: string;
}

export default function UsersOverview() {
  const navigate = useNavigate();
  const { user, galleries: contextGalleries, logout } = useAuth();
  const { addNotification } = useNotifications();
  const { setPhotos } = usePhotos();
  const [showSettings, setShowSettings] = useState(false);

  // Ensure galleries is always an array
  const galleries = Array.isArray(contextGalleries) ? contextGalleries : [];

  // Clear photos when entering galleries overview
  useEffect(() => {
    setPhotos([]);
  }, [setPhotos]);

  // Fetch preview images for galleries
  const getGalleryPreview = (galleryId: string) => {
    return useQuery({
      queryKey: ["gallery-preview", galleryId],
      queryFn: async (): Promise<GalleryPreview | null> => {
        try {
          const response = await fetch(`/api/galleries/${galleryId}/preview`);
          if (!response.ok) {
            return null;
          }
          return response.json();
        } catch (error) {
          return null;
        }
      },
      enabled: !!galleryId,
      staleTime: 5 * 60 * 1000,
    });
  };
  const [sortBy, setSortBy] = useState<
    "name-asc" | "name-desc" | "date-asc" | "date-desc" | "activity-desc"
  >(() => {
    const saved = localStorage.getItem("galleries-sort-preference");
    return (saved as typeof sortBy) || "name-asc";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Check if mobile (width < 768px)
    return window.innerWidth >= 768;
  });

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

  // Set page title
  useEffect(() => {
    document.title = `Gallerien - ${companyName}`;
  }, [companyName]);

  const filterAndSortGalleries = (galleries: any[]) => {
    // First filter by search query
    let filtered = galleries;
    if (searchQuery.trim()) {
      filtered = galleries.filter((gallery) =>
        gallery.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Then sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "name-asc":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case "date-asc":
        return sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      case "date-desc":
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      default:
        return sorted;
    }
  };

  const handleSelectGallery = (galleryId: string) => {
    // Navigate to public gallery instead of admin gallery
    navigate(`/galleries/${galleryId}`);
  };

  // Preview Image Component
  const PreviewImage = ({ galleryId }: { galleryId: string }) => {
    const { data: preview, isLoading } = getGalleryPreview(galleryId);

    if (isLoading) {
      return (
        <div className="w-full mb-4">
          <AspectRatio ratio={3 / 4}>
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
              <Image className="w-8 h-8 text-muted-foreground animate-pulse" />
            </div>
          </AspectRatio>
        </div>
      );
    }

    if (!preview) {
      return (
        <div className="w-full mb-4">
          <AspectRatio ratio={3 / 4}>
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
              <Image className="w-8 h-8 text-muted-foreground" />
            </div>
          </AspectRatio>
        </div>
      );
    }

    return (
      <div className="w-full mb-4">
        <AspectRatio ratio={3 / 4}>
          <img
            src={preview.src}
            alt={preview.alt}
            className="w-full h-full object-cover rounded-lg"
          />
        </AspectRatio>
      </div>
    );
  };

  if (showSettings) {
    return (
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <p>Lädt...</p>
          </div>
        }
      >
        <Settings onBack={() => setShowSettings(false)} hideUserManagement />
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "border-r bg-muted/10 transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-64" : "w-0",
        )}
      >
        {isSidebarOpen && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg">Alle Galerien</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filterAndSortGalleries(galleries).map((gallery) => (
                  <button
                    key={gallery.id}
                    onClick={() => handleSelectGallery(gallery.id)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center space-x-2"
                    data-testid={`sidebar-gallery-${gallery.id}`}
                  >
                    <Image className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{gallery.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background border rounded-r-md p-2 shadow-md hover:bg-muted transition-colors"
        style={{ left: isSidebarOpen ? "16rem" : "0" }}
        data-testid="toggle-sidebar"
      >
        {isSidebarOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-none xl:max-w-[2200px]">
          <div className="space-y-8">
            {/* Header mit Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1
                  className="text-3xl font-semibold mb-3"
                  data-testid="text-galleries-title"
                >{user?.name ? `${user.name} Gallerien` : "Gallerien"}
                </h1>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(true)}
                  className="hover-elevate"
                  data-testid="button-settings"
                >
                  <SettingsIcon className="w-4 h-4" />
                </Button>
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="hover-elevate"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Titel und Aktionen */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-end gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Input
                    type="text"
                    placeholder="Gallerien durchsuchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64"
                    data-testid="input-search-galleries"
                  />
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                    <Select
                      value={sortBy}
                      onValueChange={(value) => {
                        const newSortBy = value as typeof sortBy;
                        setSortBy(newSortBy);
                        localStorage.setItem(
                          "galleries-sort-preference",
                          newSortBy,
                        );
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Sortierung wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                        <SelectItem value="date-asc">Älteste zuerst</SelectItem>
                        <SelectItem value="date-desc">
                          Neueste zuerst
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Gallerien Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-8">
              {filterAndSortGalleries(galleries).length === 0 &&
              searchQuery.trim() ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  Keine Gallerien gefunden für "{searchQuery}"
                </div>
              ) : null}
              {filterAndSortGalleries(galleries).map((gallery) => (
                <Card
                  key={gallery.id}
                  className="hover-elevate transition-all duration-200 border-card-border cursor-pointer"
                  data-testid={`card-gallery-${gallery.id}`}
                  onClick={() => handleSelectGallery(gallery.id)}
                >
                  <CardContent className="p-6">
                    <PreviewImage galleryId={gallery.id} />
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3
                          className="font-semibold text-lg mb-1"
                          data-testid={`text-gallery-name-${gallery.id}`}
                        >
                          {gallery.name}
                        </h3>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
