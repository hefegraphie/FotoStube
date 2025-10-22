
import { useState } from "react";
import { Plus, Calendar, Image, MoreVertical, Edit2, Trash2, Folder } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePhotos } from "@/contexts/PhotoContext";

interface SubGallery {
  id: string;
  name: string;
  parentId: string;
  photoCount: number;
  lastModified: string;
  createdAt: string;
}

interface GalleryPreview {
  id: string;
  src: string;
  alt: string;
}

interface SubGalleriesProps {
  parentGalleryId: string;
  onSelectSubGallery: (subGalleryId: string) => void;
  isSubGallery?: boolean; // If true, this is already a sub-gallery, so don't show sub-gallery creation
  onClearSelection?: () => void;
}

export default function SubGalleries({ parentGalleryId, onSelectSubGallery, isSubGallery = false, onClearSelection }: SubGalleriesProps) {
  // Make useAuth optional for public galleries
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch (error) {
    // Not in auth context (public gallery), user remains null
  }

  const isAdmin = user?.role === "Admin";

  const { toast } = useToast();
  const { setPhotos } = usePhotos();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [subGalleryName, setSubGalleryName] = useState("");
  
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameSubGalleryId, setRenameSubGalleryId] = useState<string | null>(null);
  const [newSubGalleryName, setNewSubGalleryName] = useState("");

  // Fetch sub-galleries
  const { data: subGalleries = [], refetch } = useQuery({
    queryKey: ['sub-galleries', parentGalleryId],
    queryFn: async (): Promise<SubGallery[]> => {
      const response = await fetch(`/api/galleries/${parentGalleryId}/sub-galleries`);
      if (!response.ok) {
        throw new Error('Failed to fetch sub-galleries');
      }
      return response.json();
    },
    enabled: !!parentGalleryId,
  });

  // Create sub-gallery mutation
  const createSubGalleryMutation = useMutation({
    mutationFn: async ({ name, password }: { name: string; password: string | null }) => {
      return apiRequest('POST', '/api/galleries', {
        name,
        password: null, // Sub-galleries inherit parent password
        userId: user?.id,
        parentId: parentGalleryId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Sub-Galerie erstellt",
        description: "Die neue Sub-Galerie wurde erfolgreich erstellt.",
      });
      setIsCreateDialogOpen(false);
      setSubGalleryName("");
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Sub-Galerie konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  // Delete sub-gallery mutation
  const deleteSubGalleryMutation = useMutation({
    mutationFn: async (subGalleryId: string) => {
      return apiRequest('DELETE', `/api/galleries/${subGalleryId}`);
    },
    onSuccess: () => {
      toast({
        title: "Sub-Galerie gelöscht",
        description: "Die Sub-Galerie wurde erfolgreich gelöscht.",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Sub-Galerie konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  // Rename sub-gallery mutation
  const renameSubGalleryMutation = useMutation({
    mutationFn: async ({ subGalleryId, newName }: { subGalleryId: string; newName: string }) => {
      return apiRequest('PATCH', `/api/galleries/${subGalleryId}/rename`, {
        name: newName,
      });
    },
    onSuccess: () => {
      toast({
        title: "Sub-Galerie umbenannt",
        description: "Die Sub-Galerie wurde erfolgreich umbenannt.",
      });
      setIsRenameDialogOpen(false);
      setRenameSubGalleryId(null);
      setNewSubGalleryName("");
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Sub-Galerie konnte nicht umbenannt werden.",
        variant: "destructive",
      });
    },
  });

  // If we're already in a sub-gallery, don't show the sub-galleries section at all
  if (isSubGallery) {
    return null;
  }

  

  const handleCreateSubGallery = () => {
    if (!subGalleryName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib einen Namen für die Sub-Galerie ein.",
        variant: "destructive",
      });
      return;
    }
    createSubGalleryMutation.mutate({ 
      name: subGalleryName.trim(), 
      password: null 
    });
  };

  const handleDeleteSubGallery = (subGalleryId: string, subGalleryName: string) => {
    if (confirm(`Möchtest du die Sub-Galerie "${subGalleryName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      deleteSubGalleryMutation.mutate(subGalleryId);
    }
  };

  const handleRenameSubGallery = (subGalleryId: string, currentName: string) => {
    setRenameSubGalleryId(subGalleryId);
    setNewSubGalleryName(currentName);
    setIsRenameDialogOpen(true);
  };

  const handleConfirmRename = () => {
    if (!renameSubGalleryId || !newSubGalleryName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib einen gültigen Namen ein.",
        variant: "destructive",
      });
      return;
    }
    renameSubGalleryMutation.mutate({
      subGalleryId: renameSubGalleryId,
      newName: newSubGalleryName.trim(),
    });
  };

  

  if (subGalleries.length === 0) {
    return (
      <>
        {isAdmin && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Sub-Galerien</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Sub-Galerie erstellen
              </Button>
            </div>
          </div>
        )}

        {/* Create Sub-Gallery Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Neue Sub-Galerie erstellen</DialogTitle>
              <DialogDescription>
                Gib einen Namen für deine neue Sub-Galerie ein.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sub-gallery-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="sub-gallery-name"
                  value={subGalleryName}
                  onChange={(e) => setSubGalleryName(e.target.value)}
                  className="col-span-3"
                  placeholder="z.B. Hochzeit Tag 1"
                />
              </div>
              
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleCreateSubGallery}
                disabled={createSubGalleryMutation.isPending}
              >
                {createSubGalleryMutation.isPending ? "Erstelle..." : "Sub-Galerie erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Sub-Galerien ({subGalleries.length})</h3>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Sub-Galerie erstellen
          </Button>
        )}
      </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 mb-4">
        {subGalleries.map((subGallery) => (
          <Card
            key={subGallery.id}
            className="hover-elevate transition-all duration-200 cursor-pointer"
            onClick={() => {
              setPhotos([]); // Clear photos before navigating to sub-gallery
              onClearSelection?.(); // Clear selection before navigating
              onSelectSubGallery(subGallery.id);
            }}
          >
            <CardContent className="p-3">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Folder className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {subGallery.name}
                  </h4>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                    <div className="flex items-center space-x-1">
                      <Image className="w-3 h-3" />
                      <span>{subGallery.photoCount}</span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameSubGallery(subGallery.id, subGallery.name);
                          }}
                        >
                          <Edit2 className="h-3 w-3 mr-2" />
                          Umbenennen
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubGallery(subGallery.id, subGallery.name);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Sub-Gallery Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Neue Sub-Galerie erstellen</DialogTitle>
            <DialogDescription>
              Gib einen Namen für deine neue Sub-Galerie ein.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sub-gallery-name" className="text-right">
                Name
              </Label>
              <Input
                id="sub-gallery-name"
                value={subGalleryName}
                onChange={(e) => setSubGalleryName(e.target.value)}
                className="col-span-3"
                placeholder="z.B. Hochzeit Tag 1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateSubGallery();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={handleCreateSubGallery}
              disabled={createSubGalleryMutation.isPending}
            >
              {createSubGalleryMutation.isPending ? "Erstelle..." : "Sub-Galerie erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Sub-Gallery Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sub-Galerie umbenennen</DialogTitle>
            <DialogDescription>
              Gib einen neuen Namen für die Sub-Galerie ein.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-sub-gallery-name" className="text-right">
                Name
              </Label>
              <Input
                id="new-sub-gallery-name"
                value={newSubGalleryName}
                onChange={(e) => setNewSubGalleryName(e.target.value)}
                className="col-span-3"
                placeholder="Neuer Sub-Galerie-Name"
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
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRename}
              disabled={renameSubGalleryMutation.isPending}
            >
              {renameSubGalleryMutation.isPending ? "Umbenennen..." : "Umbenennen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
