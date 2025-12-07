
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, LogOut, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface UserAssignment {
  userId: string;
  userName: string;
  userEmail: string;
  galleries: {
    id: string;
    name: string;
  }[];
}

export default function AssignmentsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assignedGalleryIds, setAssignedGalleryIds] = useState<Set<string>>(new Set());

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "Admin") {
      navigate("/galleries");
    }
  }, [user, navigate]);

  // Fetch all users
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: user?.role === "Admin",
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch("/api/users", {
        credentials: 'include',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Fetch all galleries (only those the admin has access to)
  const { data: galleries = [] } = useQuery({
    queryKey: ["/api/galleries"],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch("/api/galleries", {
        credentials: 'include',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) throw new Error("Failed to fetch galleries");
      return response.json();
    },
  });

  // Fetch all assignments
  const { data: allAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["/api/all-assignments"],
    enabled: user?.role === "Admin",
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch("/api/all-assignments", {
        credentials: 'include',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) throw new Error("Failed to fetch assignments");
      return response.json();
    },
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
    document.title = `Zuweisungen - ${companyName}`;
  }, [companyName]);

  // Update assigned gallery IDs when user is selected
  useEffect(() => {
    if (selectedUserId) {
      const userAssignments = allAssignments
        .filter((a: any) => a.userId === selectedUserId)
        .map((a: any) => a.galleryId);
      setAssignedGalleryIds(new Set(userAssignments));
    }
  }, [selectedUserId, allAssignments]);

  // Assign gallery mutation
  const assignGalleryMutation = useMutation({
    mutationFn: async ({ galleryId, userId }: { galleryId: string; userId: string }) => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/galleries/${galleryId}/assignments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ userIds: [userId], requestingUserId: user?.id })
      });
      if (!response.ok) throw new Error('Failed to assign gallery');
      return response.json();
    },
    onSuccess: () => {
      refetchAssignments();
      toast({
        title: "Galerie zugewiesen",
        description: "Die Galerie wurde erfolgreich zugewiesen.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Galerie konnte nicht zugewiesen werden.",
        variant: "destructive",
      });
    },
  });

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ galleryId, userId }: { galleryId: string; userId: string }) => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/galleries/${galleryId}/assignments/${userId}?userId=${user?.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (response.status === 204 || response.ok) {
        return { success: true };
      }
      const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
      throw new Error(errorData.error || 'Fehler beim Entfernen der Zuweisung');
    },
    onSuccess: () => {
      refetchAssignments();
      toast({
        title: "Zuweisung entfernt",
        description: "Die Zuweisung wurde erfolgreich entfernt.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Die Zuweisung konnte nicht entfernt werden.",
        variant: "destructive",
      });
    },
  });

  const handleToggleGalleryAssignment = async (galleryId: string) => {
    if (!selectedUserId) return;

    const isCurrentlyAssigned = assignedGalleryIds.has(galleryId);

    if (isCurrentlyAssigned) {
      // Remove assignment
      await removeAssignmentMutation.mutateAsync({ galleryId, userId: selectedUserId });
    } else {
      // Add assignment
      await assignGalleryMutation.mutateAsync({ galleryId, userId: selectedUserId });
    }
  };

  // Build user assignments data for overview
  const userAssignments: UserAssignment[] = users.map((u: any) => {
    const userGalleries = allAssignments
      .filter((a: any) => a.userId === u.id)
      .map((a: any) => {
        const gallery = galleries.find((g: any) => g.id === a.galleryId);
        return gallery ? { id: gallery.id, name: gallery.name } : null;
      })
      .filter((g: any) => g !== null);

    return {
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      galleries: userGalleries,
    };
  });

  const selectedUser = users.find((u: any) => u.id === selectedUserId);

  if (user?.role !== "Admin") {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/galleries")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-semibold">Galerie-Zuweisungen</h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User List */}
          <Card>
            <CardHeader>
              <CardTitle>Benutzer</CardTitle>
              <CardDescription>
                Wähle einen Benutzer aus, um Galerien zuzuweisen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {userAssignments.map((userAssignment) => (
                    <Card
                      key={userAssignment.userId}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedUserId === userAssignment.userId ? 'bg-muted border-primary' : ''
                      }`}
                      onClick={() => setSelectedUserId(userAssignment.userId)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{userAssignment.userName}</div>
                              <div className="text-sm text-muted-foreground">
                                {userAssignment.userEmail}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {userAssignment.galleries.length} Galerie{userAssignment.galleries.length !== 1 ? 'n' : ''}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {userAssignments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Keine Benutzer gefunden
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Gallery Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedUser ? `Galerien für ${selectedUser.name}` : 'Galerien zuweisen'}
              </CardTitle>
              <CardDescription>
                {selectedUser 
                  ? 'Setze oder entferne Haken, um Galerien zuzuweisen oder die Zuweisung zu entfernen'
                  : 'Wähle zuerst einen Benutzer aus der Liste'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUserId ? (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-2">
                    {galleries.map((gallery: any) => {
                      const isAssigned = assignedGalleryIds.has(gallery.id);
                      const isOwner = gallery.userId === selectedUserId;
                      
                      return (
                        <div
                          key={gallery.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isAssigned ? 'bg-primary/5 border-primary/50' : 'hover:bg-muted/50'
                          } ${isOwner ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          onClick={() => !isOwner && handleToggleGalleryAssignment(gallery.id)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isAssigned ? 'bg-primary border-primary' : 'border-muted-foreground'
                            }`}>
                              {isAssigned && <Check className="w-4 h-4 text-primary-foreground" />}
                            </div>
                            <span className="font-medium">{gallery.name}</span>
                          </div>
                          {isOwner && (
                            <Badge variant="outline" className="text-xs">
                              Eigentümer
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                    {galleries.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Keine Galerien verfügbar
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                  Wähle einen Benutzer aus, um Galerien zuzuweisen
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
