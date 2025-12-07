import { Calendar, Image, Plus, Trash2, MoreVertical, Link, Copy, Edit2, ArrowUpDown, Lock, Eye, EyeOff, Settings, ChevronLeft, ChevronRight, Check, Download, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
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
import { useState, useEffect } from "react";
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
  onOpenSettings: () => void;
}

export default function GalleriesOverview({ onSelectGallery, onOpenSettings }: GalleriesOverviewProps) {
  const { galleries, user, refetchGalleries, logout } = useAuth();
  const { toast } = useToast();
  const isAdminOrCreator = user?.role === "Admin" || user?.role === "Creator";
  const isAdmin = user?.role === "Admin";
  const [galleryName, setGalleryName] = useState("");
  const [galleryPassword, setGalleryPassword] = useState("");
  const [allowDownload, setAllowDownload] = useState(true); // New state for download permission
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
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignGalleryId, setAssignGalleryId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Check if mobile (width < 768px)
    return window.innerWidth >= 768;
  });
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<Set<string>>(new Set());
  const [isBatchAssignDialogOpen, setIsBatchAssignDialogOpen] = useState(false);
  const [batchSelectedUserIds, setBatchSelectedUserIds] = useState<string[]>([]);
  const [isDownloadSettingsDialogOpen, setIsDownloadSettingsDialogOpen] = useState(false);
  const [downloadSettingsGalleryId, setDownloadSettingsGalleryId] = useState<string | null>(null);
  const [downloadSettingsAllowDownload, setDownloadSettingsAllowDownload] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editGalleryId, setEditGalleryId] = useState<string | null>(null);
  const [editGalleryName, setEditGalleryName] = useState("");
  const [editGalleryPassword, setEditGalleryPassword] = useState("");
  const [editOriginalPassword, setEditOriginalPassword] = useState("");
  const [editAllowDownload, setEditAllowDownload] = useState(true);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const navigate = useNavigate();


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

  // Fetch all users for assignment
  const { data: allUsers = [] } = useQuery({
    queryKey: [`/api/users?userId=${user?.id}`],
    queryFn: async () => {
      const response = await fetch(`/api/users?userId=${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch gallery assignments
  const { data: galleryAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['gallery-assignments', assignGalleryId],
    queryFn: async () => {
      if (!assignGalleryId) return [];
      const response = await fetch(`/api/galleries/${assignGalleryId}/assignments?userId=${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch assignments');
      return response.json();
    },
    enabled: !!assignGalleryId && isAssignDialogOpen && !!user?.id,
  });

  // Update download settings mutation
  const updateDownloadSettingsMutation = useMutation({
    mutationFn: async ({ galleryId, allowDownload }: { galleryId: string; allowDownload: boolean }) => {
      return apiRequest('PATCH', `/api/galleries/${galleryId}/download-settings`, { allowDownload });
    },
    onSuccess: () => {
      toast({
        title: "Download-Einstellungen aktualisiert",
        description: "Die Download-Einstellungen wurden erfolgreich gespeichert.",
      });
      setIsDownloadSettingsDialogOpen(false);
      setDownloadSettingsGalleryId(null);
      refetchGalleries();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Download-Einstellungen konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  // Edit gallery mutation (name, password, download settings)
  const editGalleryMutation = useMutation({
    mutationFn: async ({ galleryId, name, password, allowDownload, keepCurrentPassword }: { 
      galleryId: string; 
      name: string; 
      password: string;
      allowDownload: boolean;
      keepCurrentPassword: boolean;
    }) => {
      // Update name
      await apiRequest('PATCH', `/api/galleries/${galleryId}/rename`, { name });
      
      // Update password only if it was changed
      if (!keepCurrentPassword) {
        await apiRequest('PATCH', `/api/galleries/${galleryId}/password`, { 
          password: password.trim() || null 
        });
      }
      
      // Update download settings
      await apiRequest('PATCH', `/api/galleries/${galleryId}/download-settings`, { allowDownload });
      
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Galerie aktualisiert",
        description: "Die Galerie wurde erfolgreich bearbeitet.",
      });
      setIsEditDialogOpen(false);
      setEditGalleryId(null);
      setEditGalleryName("");
      setEditGalleryPassword("");
      setEditOriginalPassword("");
      setEditAllowDownload(true);
      refetchGalleries();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Galerie konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  // Create gallery mutation
  const createGalleryMutation = useMutation({
    mutationFn: async ({ name, password, allowDownload }: { name: string; password: string | null; allowDownload: boolean }) => {
      return apiRequest('POST', '/api/galleries', {
        name,
        password,
        allowDownload,
        userId: user?.id,
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
      setAllowDownload(true); // Reset to default
      setShowCreatePassword(false);
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
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/galleries/${galleryId}?userId=${user?.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      // 204 No Content is success for DELETE
      if (response.status === 204 || response.ok) {
        return { success: true };
      }

      const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
      throw new Error(errorData.error || 'Fehler beim Löschen');
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
        description: error.message || "Die Galerie konnte nicht gelöscht werden.",
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

  // Assign gallery mutation
  const assignGalleryMutation = useMutation({
    mutationFn: async ({ galleryId, userIds }: { galleryId: string; userIds: string[] }) => {
      return apiRequest('POST', `/api/galleries/${galleryId}/assignments`, { 
        userIds,
        requestingUserId: user?.id // Send the current user's ID for admin check
      });
    },
    onSuccess: () => {
      toast({
        title: "Galerie zugewiesen",
        description: "Die Galerie wurde erfolgreich zugewiesen.",
      });
      refetchAssignments();
      setSelectedUserIds([]);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: "Die Galerie konnte nicht zugewiesen werden.",
        variant: "destructive",
      });
    },
  });

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ galleryId, userId, requestingUserId }: { galleryId: string; userId: string; requestingUserId?: string }) => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/galleries/${galleryId}/assignments/${userId}?userId=${requestingUserId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      // 204 No Content is success for DELETE
      if (response.status === 204 || response.ok) {
        return { success: true };
      }

      const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
      throw new Error(errorData.error || 'Fehler beim Entfernen der Zuweisung');
    },
    onSuccess: () => {
      toast({
        title: "Zuweisung entfernt",
        description: "Die Zuweisung wurde erfolgreich entfernt.",
      });
      refetchAssignments();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Die Zuweisung konnte nicht entfernt werden.",
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
    createGalleryMutation.mutate({ 
      name: galleryName.trim(), 
      password: galleryPassword.trim() ? galleryPassword.trim() : null,
      allowDownload 
    });
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

  const handleOpenAssignDialog = (galleryId: string) => {
    setAssignGalleryId(galleryId);
    setSelectedUserIds([]);
    setIsAssignDialogOpen(true);
  };

  const handleAssignUsers = () => {
    if (!assignGalleryId || selectedUserIds.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wähle mindestens einen Benutzer aus.",
        variant: "destructive",
      });
      return;
    }
    assignGalleryMutation.mutate({
      galleryId: assignGalleryId,
      userIds: selectedUserIds,
    });
  };

  const handleRemoveAssignment = (userId: string) => {
    if (!assignGalleryId) return;
    removeAssignmentMutation.mutate({
      galleryId: assignGalleryId,
      userId,
      requestingUserId: user?.id,
    });
  };

  const handleToggleGallerySelection = (galleryId: string) => {
    setSelectedGalleryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(galleryId)) {
        newSet.delete(galleryId);
      } else {
        newSet.add(galleryId);
      }
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedGalleryIds(new Set());
  };

  const handleBatchDelete = async () => {
    const galleryNames = Array.from(selectedGalleryIds)
      .map(id => galleries.find(g => g.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    if (!confirm(`Möchtest du wirklich ${selectedGalleryIds.size} Galerie(n) löschen: ${galleryNames}?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const galleryId of selectedGalleryIds) {
      try {
        await deleteGalleryMutation.mutateAsync(galleryId);
        successCount++;
      } catch (error) {
        console.error(`Failed to delete gallery ${galleryId}:`, error);
        errorCount++;
      }
    }

    toast({
      title: successCount > 0 ? "Gallerien gelöscht" : "Fehler",
      description: `${successCount} Galerie(n) gelöscht${errorCount > 0 ? `, ${errorCount} fehlgeschlagen` : ''}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });

    setSelectedGalleryIds(new Set());
  };

  const handleBatchAssign = () => {
    setIsBatchAssignDialogOpen(true);
    setBatchSelectedUserIds([]);
  };

  const handleConfirmBatchAssign = async () => {
    if (batchSelectedUserIds.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wähle mindestens einen Benutzer aus.",
        variant: "destructive",
      });
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const galleryId of selectedGalleryIds) {
      try {
        await assignGalleryMutation.mutateAsync({
          galleryId,
          userIds: batchSelectedUserIds,
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to assign gallery ${galleryId}:`, error);
        errorCount++;
      }
    }

    toast({
      title: successCount > 0 ? "Gallerien zugewiesen" : "Fehler",
      description: `${successCount} Galerie(n) zugewiesen${errorCount > 0 ? `, ${errorCount} fehlgeschlagen` : ''}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });

    setIsBatchAssignDialogOpen(false);
    setBatchSelectedUserIds([]);
    setSelectedGalleryIds(new Set());
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

  const handleOpenDownloadSettings = (galleryId: string) => {
    setDownloadSettingsGalleryId(galleryId);
    // Fetch current download settings for this gallery
    const gallery = galleries.find(g => g.id === galleryId);
    if (gallery) {
      setDownloadSettingsAllowDownload(gallery.allowDownload ?? true);
    } else {
      setDownloadSettingsAllowDownload(true);
    }
    setIsDownloadSettingsDialogOpen(true);
  };

  const handleUpdateDownloadSettings = () => {
    if (!downloadSettingsGalleryId) return;
    updateDownloadSettingsMutation.mutate({
      galleryId: downloadSettingsGalleryId,
      allowDownload: downloadSettingsAllowDownload,
    });
  };

  const handleOpenEditDialog = async (galleryId: string) => {
    const gallery = galleries.find(g => g.id === galleryId);
    if (!gallery) return;
    
    setEditGalleryId(galleryId);
    setEditGalleryName(gallery.name);
    setEditAllowDownload(gallery.allowDownload ?? true);
    
    // Load current password from database
    try {
      const response = await fetch(`/api/galleries/${galleryId}/password`);
      if (response.ok) {
        const data = await response.json();
        const currentPassword = data.password || "";
        setEditGalleryPassword(currentPassword);
        setEditOriginalPassword(currentPassword);
      } else {
        setEditGalleryPassword("");
        setEditOriginalPassword("");
      }
    } catch (error) {
      console.error("Error loading gallery password:", error);
      setEditGalleryPassword("");
      setEditOriginalPassword("");
    }
    
    setIsEditDialogOpen(true);
  };

  const handleConfirmEdit = () => {
    if (!editGalleryId || !editGalleryName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib einen gültigen Namen ein.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if password was changed
    const passwordChanged = editGalleryPassword !== editOriginalPassword;
    
    editGalleryMutation.mutate({
      galleryId: editGalleryId,
      name: editGalleryName.trim(),
      password: editGalleryPassword,
      allowDownload: editAllowDownload,
      keepCurrentPassword: !passwordChanged,
    });
  };

  const filterAndSortGalleries = (galleries: any[]) => {
    // First filter by search query
    let filtered = galleries;
    if (searchQuery.trim()) {
      filtered = galleries.filter(gallery => 
        gallery.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Then sort
    const sorted = [...filtered];
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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header über gesamte Breite */}
      <div className="border-b bg-background px-4 sm:px-6 py-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Titel und User-Aktionen */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-semibold" data-testid="text-galleries-title">
              {user?.name} Gallerien
            </h1>
            <div className="flex items-center gap-2 lg:hidden">
              <NotificationBell />
              <ThemeToggle />
              {user?.role === "Admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/assignments")}
                  className="hover-elevate"
                  data-testid="button-assignments"
                >
                  <Users className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                className="hover-elevate"
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
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
          
          {/* Suche, Sortierung und Aktionen */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:flex-1 lg:justify-end">
            <Input
              type="text"
              placeholder="Durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-48 lg:w-64"
              data-testid="input-search-galleries"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center flex-1 sm:flex-initial gap-2">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
                <Select value={sortBy} onValueChange={(value) => {
                  const newSortBy = value as typeof sortBy;
                  setSortBy(newSortBy);
                  localStorage.setItem('galleries-sort-preference', newSortBy);
                }}>
                  <SelectTrigger className="w-full sm:w-40 lg:w-48">
                    <SelectValue placeholder="Sortierung" />
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
              {isAdminOrCreator && (
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="default" className="flex-shrink-0" data-testid="button-create-gallery">
                      <Plus className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Neue Galerie</span>
                    </Button>
                  </DialogTrigger>
                </Dialog>
              )}
            </div>
            
            {/* Desktop User-Aktionen */}
            <div className="hidden lg:flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
              {user?.role === "Admin" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/assignments")}
                  className="hover-elevate"
                  data-testid="button-assignments"
                >
                  <Users className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                className="hover-elevate"
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
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
        </div>
      </div>

      {/* Content Bereich mit Sidebar */}
      <div className="flex flex-1 overflow-hidden relative">
        <ResizablePanelGroup 
          key={isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} 
          direction="horizontal" 
          className="flex-1"
        >
          {/* Sidebar Panel */}
          {isSidebarOpen && (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
                <div className="h-full border-r bg-muted/10 flex flex-col overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {filterAndSortGalleries(galleries).map((gallery) => (
                      <div
                        key={gallery.id}
                        className="w-full px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center justify-between group"
                        data-testid={`sidebar-gallery-${gallery.id}`}
                      >
                        <button
                          onClick={() => onSelectGallery(gallery.id)}
                          className="flex-1 text-left truncate"
                        >
                          {gallery.name}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = `${window.location.origin}/gallery/${gallery.id}`;
                            navigator.clipboard.writeText(link).then(() => {
                              toast({
                                title: "Link kopiert",
                                description: "Der öffentliche Link wurde in die Zwischenablage kopiert.",
                              });
                            }).catch(() => {
                              toast({
                                title: "Fehler",
                                description: "Link konnte nicht kopiert werden.",
                                variant: "destructive",
                              });
                            });
                          }}
                          className="flex-shrink-0 p-1 hover:bg-accent rounded ml-2"
                          title="Öffentlichen Link kopieren"
                        >
                          <Link className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Main Content Panel */}
          <ResizablePanel defaultSize={isSidebarOpen ? 80 : 100}>
            <div className="h-full overflow-y-auto">
              <div className="container mx-auto p-6 max-w-none xl:max-w-[2200px]">
                <div className="space-y-8">

        {/* Edit Gallery Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Galerie bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeite Name, Passwort und Download-Einstellungen der Galerie.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-gallery-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-gallery-name"
                  value={editGalleryName}
                  onChange={(e) => setEditGalleryName(e.target.value)}
                  className="col-span-3"
                  placeholder="Galerie-Name"
                  data-testid="input-edit-gallery-name"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-gallery-password" className="text-right">
                  Passwort
                </Label>
                <div className="col-span-3 flex space-x-2">
                  <div className="relative flex-1">
                    <Input
                      id="edit-gallery-password"
                      type={showEditPassword ? "text" : "password"}
                      value={editGalleryPassword}
                      onChange={(e) => setEditGalleryPassword(e.target.value)}
                      className="pr-10"
                      placeholder="Aktuelles Passwort"
                      data-testid="input-edit-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                    >
                      {showEditPassword ? (
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
                    onClick={() => setEditGalleryPassword(generatePassword())}
                    className="px-3"
                  >
                    Generieren
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-allow-download" className="text-right">
                  Downloads
                </Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <input
                    id="edit-allow-download"
                    type="checkbox"
                    checked={editAllowDownload}
                    onChange={(e) => setEditAllowDownload(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-muted-foreground">
                    Downloads erlauben
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                data-testid="button-cancel-edit"
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleConfirmEdit}
                disabled={editGalleryMutation.isPending}
                data-testid="button-confirm-edit"
              >
                {editGalleryMutation.isPending ? "Speichern..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

        {/* Download Settings Dialog */}
        <Dialog open={isDownloadSettingsDialogOpen} onOpenChange={setIsDownloadSettingsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Download-Einstellungen</DialogTitle>
              <DialogDescription>
                Stelle ein, ob Besucher Fotos aus dieser Galerie herunterladen dürfen.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2 py-4">
              <input
                id="download-settings-allow"
                type="checkbox"
                checked={downloadSettingsAllowDownload}
                onChange={(e) => setDownloadSettingsAllowDownload(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="download-settings-allow" className="text-sm font-medium">
                Downloads erlauben
              </label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDownloadSettingsDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleUpdateDownloadSettings}
                disabled={updateDownloadSettingsMutation.isPending}
              >
                {updateDownloadSettingsMutation.isPending ? "Speichert..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Public Link Dialog */}
        <Dialog open={showPublicLink !== null} onOpenChange={() => setShowPublicLink(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Öffentlicher Link</DialogTitle>
              <DialogDescription>
                Teile diesen Link mit anderen, um die Galerie anzuzeigen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <Input
                  id="public-link"
                  value={`${window.location.origin}/gallery/${showPublicLink}`}
                  readOnly
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/gallery/${showPublicLink}`);
                    toast({
                      title: "Link kopiert",
                      description: "Der öffentliche Link wurde in die Zwischenablage kopiert.",
                    });
                    setShowPublicLink(null);
                  }}
                >
                  Kopieren
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPublicLink(null)}
              >
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Gallerien Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filterAndSortGalleries(galleries).length === 0 && searchQuery.trim() ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Keine Gallerien gefunden für "{searchQuery}"
            </div>
          ) : null}
          {filterAndSortGalleries(galleries).map((gallery) => (
            <Card
              key={gallery.id}
              className={`overflow-hidden hover-elevate cursor-pointer group ${selectedGalleryIds.has(gallery.id) ? 'ring-2 ring-primary' : ''}`}
              data-testid={`card-gallery-${gallery.id}`}
              onClick={() => onSelectGallery(gallery.id)}
            >
              <div className="relative">
                <PreviewImage galleryId={gallery.id} />
                
                {/* Selection Button - Top Left */}
                {isAdminOrCreator && (
                  <div className="absolute top-2 left-2">
                    <Button
                      variant={selectedGalleryIds.has(gallery.id) ? "default" : "secondary"}
                      size="icon"
                      className="w-8 h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleGallerySelection(gallery.id);
                      }}
                      data-testid={`button-select-gallery-${gallery.id}`}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {/* Gallery name overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                  <p className="text-white text-sm font-medium px-4 text-center break-words">
                    {gallery.name}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="p-2">
                <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm mb-1 truncate" data-testid={`text-gallery-name-${gallery.id}`}>
                    {gallery.name}
                  </h3>
                </div>
                {isAdminOrCreator && (
                  <div className="flex items-center space-x-2 flex-shrink-0">
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
                              handleOpenEditDialog(gallery.id);
                            }}
                            data-testid={`button-edit-gallery-${gallery.id}`}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAssignDialog(gallery.id);
                              }}
                              data-testid={`button-assign-gallery-${gallery.id}`}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Galerie zuweisen
                            </DropdownMenuItem>
                          )}
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
                            <Trash2 className="h-4 w-4" />
                            Galerie löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Batch Assignment Dialog */}
        <Dialog open={isBatchAssignDialogOpen} onOpenChange={setIsBatchAssignDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Gallerien zuweisen ({selectedGalleryIds.size} ausgewählt)</DialogTitle>
              <DialogDescription>
                Weise die ausgewählten Gallerien anderen Benutzern zu.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Benutzer auswählen</Label>
                <div className="border rounded-md p-2 space-y-1 max-h-60 overflow-y-auto">
                  {allUsers
                    .filter((u: any) => u.id !== user?.id)
                    .map((u: any) => (
                      <div
                        key={u.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-sm cursor-pointer"
                        onClick={() => {
                          setBatchSelectedUserIds(prev =>
                            prev.includes(u.id)
                              ? prev.filter(id => id !== u.id)
                              : [...prev, u.id]
                          );
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={batchSelectedUserIds.includes(u.id)}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{u.name}</div>
                        </div>
                      </div>
                    ))}
                  {allUsers.filter((u: any) => u.id !== user?.id).length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Keine weiteren Benutzer verfügbar
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBatchAssignDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleConfirmBatchAssign}
                disabled={batchSelectedUserIds.length === 0}
              >
                Zuweisen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assignment Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Galerie zuweisen</DialogTitle>
              <DialogDescription>
                Weise diese Galerie anderen Benutzern zu, damit sie darauf zugreifen können.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Current Assignments */}
              {galleryAssignments.length > 0 && (
                <div className="space-y-2">
                  <Label>Aktuelle Zuweisungen</Label>
                  <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                    {galleryAssignments.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-sm">
                        <div>
                          <div className="font-medium text-sm">{assignment.userName}</div>
                          <div className="text-xs text-muted-foreground">{assignment.userEmail}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAssignment(assignment.userId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Assignments */}
              <div className="space-y-2">
                <Label>Benutzer hinzufügen</Label>
                <div className="border rounded-md p-2 space-y-1 max-h-60 overflow-y-auto">
                  {allUsers
                    .filter((u: any) => u.id !== user?.id && !galleryAssignments.some((a: any) => a.userId === u.id))
                    .map((u: any) => (
                      <div
                        key={u.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-sm cursor-pointer"
                        onClick={() => {
                          setSelectedUserIds(prev =>
                            prev.includes(u.id)
                              ? prev.filter(id => id !== u.id)
                              : [...prev, u.id]
                          );
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    ))}
                  {allUsers.filter((u: any) => u.id !== user?.id && !galleryAssignments.some((a: any) => a.userId === u.id)).length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Keine weiteren Benutzer verfügbar
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssignDialogOpen(false)}
              >
                Schließen
              </Button>
              <Button
                type="button"
                onClick={handleAssignUsers}
                disabled={selectedUserIds.length === 0 || assignGalleryMutation.isPending}
              >
                {assignGalleryMutation.isPending ? "Zuweisen..." : "Zuweisen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="allow-download" className="text-right">
                  Downloads erlauben
                </Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <input
                    id="allow-download"
                    type="checkbox"
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-muted-foreground">
                    Besuchern das Herunterladen von Fotos erlauben
                  </span>
                </div>
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

        {/* Batch Operations Menu */}
        {selectedGalleryIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
            <div className="container mx-auto max-w-none xl:max-w-[2200px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium">
                    {selectedGalleryIds.size} Galerie(n) ausgewählt
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                  >
                    Auswahl aufheben
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchAssign}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Zuweisen
                    </Button>
                  )}
                  {isAdminOrCreator && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBatchDelete}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Löschen
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background border rounded-r-md p-2 shadow-md hover:bg-muted transition-colors"
          data-testid="toggle-sidebar"
        >
          {isSidebarOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}