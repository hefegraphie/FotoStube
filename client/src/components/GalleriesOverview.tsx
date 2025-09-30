import { Calendar, Image, Plus, Trash2, MoreVertical, Link, Copy, Edit2, ArrowUpDown, Lock, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import { LogOut } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface GalleryPreview {
  id: string;
  src: string;
  alt: string;
}

interface GalleriesOverviewProps {
  onSelectGallery: (galleryId: string) => void;
}

export default function GalleriesOverview({ onSelectGallery }: GalleriesOverviewProps) {
  const { galleries, user, refetchGalleries, logout } = useAuth();
  const { toast } = useToast();
  const [galleryName, setGalleryName] = useState("");
  const [galleryPassword, setGalleryPassword] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPublicLink, setShowPublicLink] = useState<string | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameGalleryId, setRenameGalleryId] = useState<string | null>(null);
  const [newGalleryName, setNewGalleryName] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordGalleryId, setPasswordGalleryId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | 'activity-desc'>(() => {
    const saved = localStorage.getItem('galleries-sort-preference');
    return (saved as typeof sortBy) || 'name-asc';
  });

  const generatePassword = (length: number = 12): string => {
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const allChars = uppercaseChars + lowercaseChars + numberChars;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
    password += lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
    password += numberChars[Math.floor(Math.random() * numberChars.length)];
    
    // Fill the rest randomly
    for (let i = 3; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password to randomize the order
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  // Fetch preview images for galleries
  const getGalleryPreview = (galleryId: string) => {
    return useQuery({
      queryKey: ['gallery-preview', galleryId],
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
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Fetch gallery activities for sorting
  const { data: galleryActivities = {} } = useQuery({
    queryKey: ['gallery-activities', user?.id],
    queryFn: async (): Promise<Record<string, string>> => {
      try {
        const response = await fetch(`/api/galleries/activities?userId=${user?.id}`);
        if (!response.ok) {
          return {};
        }
        return response.json();
      } catch (error) {
        return {};
      }
    },
    enabled: sortBy === 'activity-desc' && !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Create gallery mutation
  const createGalleryMutation = useMutation({
    mutationFn: async ({ name, password }: { name: string; password: string }) => {
      return apiRequest('POST', '/api/galleries', {
        name,
        password: password.trim() || null,
        userId: user.id,
      });
    },
    onSuccess: () => {
      toast({
        title: "Galerie erstellt",
        description: "Die neue Galerie wurde erfolgreich erstellt.",
      });
      setIsCreateDialogOpen(false);
      setGalleryName("");
      setGalleryPassword("");
      refetchGalleries();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Galerie konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  // Delete gallery mutation
  const deleteGalleryMutation = useMutation({
    mutationFn: async (galleryId: string) => {
      return apiRequest('DELETE', `/api/galleries/${galleryId}`);
    },
    onSuccess: () => {
      toast({
        title: "Galerie gelöscht",
        description: "Die Galerie wurde erfolgreich gelöscht.",
      });
      refetchGalleries();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Galerie konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  // Rename gallery mutation
  const renameGalleryMutation = useMutation({
    mutationFn: async ({ galleryId, newName }: { galleryId: string; newName: string }) => {
      return apiRequest('PATCH', `/api/galleries/${galleryId}/rename`, {
        name: newName,
      });
    },
    onSuccess: () => {
      toast({
        title: "Galerie umbenannt",
        description: "Die Galerie wurde erfolgreich umbenannt.",
      });
      setIsRenameDialogOpen(false);
      setRenameGalleryId(null);
      setNewGalleryName("");
      refetchGalleries();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Galerie konnte nicht umbenannt werden.",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async ({ galleryId, password }: { galleryId: string; password: string }) => {
      return apiRequest('PATCH', `/api/galleries/${galleryId}/password`, {
        password: password.trim() || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Passwort geändert",
        description: "Das Galerie-Passwort wurde erfolgreich geändert.",
      });
      setIsPasswordDialogOpen(false);
      setPasswordGalleryId(null);
      setNewPassword("");
      refetchGalleries();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Das Passwort konnte nicht geändert werden.",
        variant: "destructive",
      });
    },
  });

  const handleCreateGallery = () => {
    if (!galleryName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib einen Namen für die Galerie ein.",
        variant: "destructive",
      });
      return;
    }
    createGalleryMutation.mutate({ name: galleryName.trim(), password: galleryPassword });
  };

  const handleDeleteGallery = (galleryId: string, galleryName: string) => {
    if (confirm(`Möchtest du die Galerie "${galleryName}" wirklich löschen? Diese Aktion kann nicht rückgänig gemacht werden.`)) {
      deleteGalleryMutation.mutate(galleryId);
    }
  };

  const handleRenameGallery = (galleryId: string, currentName: string) => {
    setRenameGalleryId(galleryId);
    setNewGalleryName(currentName);
    setIsRenameDialogOpen(true);
  };

  const handleConfirmRename = () => {
    if (!renameGalleryId || !newGalleryName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib einen gültigen Namen ein.",
        variant: "destructive",
      });
      return;
    }
    renameGalleryMutation.mutate({
      galleryId: renameGalleryId,
      newName: newGalleryName.trim(),
    });
  };

  const handleChangePassword = (galleryId: string) => {
    setPasswordGalleryId(galleryId);
    setNewPassword("");
    setIsPasswordDialogOpen(true);
  };

  const handleConfirmPasswordChange = () => {
    if (!passwordGalleryId) {
      toast({
        title: "Fehler",
        description: "Keine Galerie ausgewählt.",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({
      galleryId: passwordGalleryId,
      password: newPassword,
    });
  };

  const handleCopyPublicLink = (galleryId: string) => {
    const link = `${window.location.origin}/gallery/${galleryId}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({
        title: "Link kopiert",
        description: "Der öffentliche Link zur Galerie wurde in die Zwischenablage kopiert.",
      });
      setShowPublicLink(null);
    }).catch(err => {
      toast({
        title: "Fehler beim Kopieren",
        description: "Der Link konnte nicht in die Zwischenablage kopiert werden.",
        variant: "destructive",
      });
    });
  };

  const sortGalleries = (galleries: any[]) => {
    const sorted = [...galleries];

    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'activity-desc':
        return sorted.sort((a, b) => {
          const activityA = galleryActivities[a.id] ? new Date(galleryActivities[a.id]).getTime() : 0;
          const activityB = galleryActivities[b.id] ? new Date(galleryActivities[b.id]).getTime() : 0;
          return activityB - activityA;
        });
      default:
        return sorted;
    }
  };

  // Preview Image Component
  const PreviewImage = ({ galleryId }: { galleryId: string }) => {
    const { data: preview, isLoading } = getGalleryPreview(galleryId);

    if (isLoading) {
      return (
        <div className="w-full mb-4">
          <AspectRatio ratio={3/4}>
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
          <AspectRatio ratio={3/4}>
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
              <Image className="w-8 h-8 text-muted-foreground" />
            </div>
          </AspectRatio>
        </div>
      );
    }

    return (
      <div className="w-full mb-4">
        <AspectRatio ratio={3/4}>
          <img
            src={preview.src}
            alt={preview.alt}
            className="w-full h-full object-cover rounded-lg"
          />
        </AspectRatio>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-none xl:max-w-[2200px]">
      <div className="space-y-8">
        {/* Header mit Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-medium">Foto Gallerie</h2>
          </div>
          <div className="flex items-center space-x-3">
            <NotificationBell />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="hover-elevate"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Titel und Aktionen */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold mb-3" data-testid="text-galleries-title">
                {user?.name} Gallerien
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(value) => {
                  const newSortBy = value as typeof sortBy;
                  setSortBy(newSortBy);
                  localStorage.setItem('galleries-sort-preference', newSortBy);
                }}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Sortierung wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="date-asc">Älteste zuerst</SelectItem>
                    <SelectItem value="date-desc">Neueste zuerst</SelectItem>
                    <SelectItem value="activity-desc">Neuste Aktivität</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full sm:w-auto" data-testid="button-create-gallery">
                    <Plus className="w-4 h-4 mr-2" />
                    Neue Galerie
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </div>


        {/* Rename Gallery Dialog */}
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Galerie umbenennen</DialogTitle>
              <DialogDescription>
                Gib einen neuen Namen für die Galerie ein.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-gallery-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="new-gallery-name"
                  value={newGalleryName}
                  onChange={(e) => setNewGalleryName(e.target.value)}
                  className="col-span-3"
                  placeholder="Neuer Galerie-Name"
                  data-testid="input-new-gallery-name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConfirmRename();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameDialogOpen(false)}
                data-testid="button-cancel-rename"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleConfirmRename}
                disabled={renameGalleryMutation.isPending}
                data-testid="button-confirm-rename"
              >
                {renameGalleryMutation.isPending ? "Umbenennen..." : "Umbenennen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Passwort ändern</DialogTitle>
              <DialogDescription>
                Gib ein neues Passwort für die Galerie ein. Lasse das Feld leer, um den Passwortschutz zu entfernen.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-password" className="text-right">
                  Passwort
                </Label>
                <div className="col-span-3 flex space-x-2">
                  <div className="relative flex-1">
                    <Input
                      id="new-password"
                      type={showChangePassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                      placeholder="Neues Passwort (optional)"
                      data-testid="input-new-password"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleConfirmPasswordChange();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowChangePassword(!showChangePassword)}
                    >
                      {showChangePassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNewPassword(generatePassword())}
                    className="px-3"
                  >
                    Generieren
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Wenn du ein Passwort eingibst, müssen Besucher dieses eingeben, um die Galerie zu sehen. 
                Lasse das Feld leer, um den Passwortschutz zu entfernen.
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPasswordDialogOpen(false)}
                data-testid="button-cancel-password"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleConfirmPasswordChange}
                disabled={changePasswordMutation.isPending}
                data-testid="button-confirm-password"
              >
                {changePasswordMutation.isPending ? "Ändern..." : "Passwort ändern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Gallerien Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-8">
          {sortGalleries(galleries).map((gallery) => (
            <Card
              key={gallery.id}
              className="hover-elevate transition-all duration-200 border-card-border cursor-pointer"
              data-testid={`card-gallery-${gallery.id}`}
              onClick={() => onSelectGallery(gallery.id)}
            >
              <CardContent className="p-6">
                <PreviewImage galleryId={gallery.id} />
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1" data-testid={`text-gallery-name-${gallery.id}`}>
                    {gallery.name}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  {showPublicLink === gallery.id ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyPublicLink(gallery.id);
                      }}
                      data-testid={`button-copy-public-link-${gallery.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-gallery-menu-${gallery.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameGallery(gallery.id, gallery.name);
                          }}
                          data-testid={`button-rename-gallery-${gallery.id}`}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Galerie umbenennen
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleChangePassword(gallery.id);
                          }}
                          data-testid={`button-change-password-${gallery.id}`}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Passwort ändern
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPublicLink(gallery.id);
                          }}
                          data-testid={`button-show-public-link-${gallery.id}`}
                        >
                          <Link className="h-4 w-4 mr-2" />
                          Öffentlichen Link anzeigen
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGallery(gallery.id, gallery.name);
                          }}
                          className="text-destructive focus:text-destructive"
                          data-testid={`button-delete-gallery-${gallery.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Galerie löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>

        {/* Create Gallery Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Neue Galerie erstellen</DialogTitle>
              <DialogDescription>
                Gib einen Namen für deine neue Galerie ein. Du kannst später Fotos hinzufügen.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="gallery-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="gallery-name"
                  value={galleryName}
                  onChange={(e) => setGalleryName(e.target.value)}
                  className="col-span-3"
                  placeholder="z.B. Hochzeit 2024"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="gallery-password" className="text-right">
                  Passwort
                </Label>
                <div className="col-span-3 flex space-x-2">
                  <div className="relative flex-1">
                    <Input
                      id="gallery-password"
                      type={showCreatePassword ? "text" : "password"}
                      value={galleryPassword}
                      onChange={(e) => setGalleryPassword(e.target.value)}
                      className="pr-10"
                      placeholder="Optional - für privaten Zugang"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateGallery();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                    >
                      {showCreatePassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setGalleryPassword(generatePassword())}
                    className="px-3"
                  >
                    Generieren
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Wenn du ein Passwort eingibst, müssen Besucher dieses eingeben, um die Galerie zu sehen.
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                data-testid="button-cancel-create"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleCreateGallery}
                disabled={createGalleryMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createGalleryMutation.isPending ? "Erstelle..." : "Galerie erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}