import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SettingsProps {
  onBack: () => void;
  hideUserManagement?: boolean;
}

interface User {
  id: string;
  name: string;
  role: string;
}

export default function Settings({ onBack, hideUserManagement = false }: SettingsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Account Settings State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newName, setNewName] = useState(user?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // User Management State (Admin only)
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: "",
    password: "",
    role: "User",
  });
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  // Branding State
  const [companyName, setCompanyName] = useState("");

  // Fetch branding settings
  const { data: brandingData } = useQuery({
    queryKey: ["/api/branding"],
    queryFn: async () => {
      const response = await fetch("/api/branding");
      if (!response.ok) throw new Error("Failed to fetch branding");
      return response.json();
    },
  });

  // Set company name when data loads
  useEffect(() => {
    if (brandingData?.companyName) {
      setCompanyName(brandingData.companyName);
    }
  }, [brandingData]);

  // Set page title
  useEffect(() => {
    const name = brandingData?.companyName || "PhotoGallery";
    document.title = `Einstellungen - ${name}`;
  }, [brandingData]);

  const handleBrandingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib einen Firmennamen ein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch("/api/branding", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: "Branding wurde erfolgreich aktualisiert.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      } else {
        const error = await response.json();
        toast({
          title: "Fehler",
          description: error.error || "Branding konnte nicht aktualisiert werden.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all users (Admin only)
  const { data: users = [], refetch: refetchUsers } = useQuery({
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Fehler",
        description: "Bitte fülle alle Felder aus.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Die neuen Passwörter stimmen nicht überein.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Fehler",
        description: "Das neue Passwort muss mindestens 6 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id,
          currentPassword,
          newPassword,
        }),
      });

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: "Dein Passwort wurde erfolgreich geändert.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const error = await response.json();
        toast({
          title: "Fehler",
          description: error.error || "Passwort konnte nicht geändert werden.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName || newName === user?.name) {
      toast({
        title: "Fehler",
        description: "Bitte gib einen neuen Namen ein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch("/api/auth/change-name", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          userId: user?.id,
          newName,
        }),
      });

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: "Dein Name wurde erfolgreich geändert.",
        });
        // Update local user data
        const updatedUser = { ...user, name: newName };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload(); // Reload to update auth context
      } else {
        const error = await response.json();
        toast({
          title: "Fehler",
          description: error.error || "Name konnte nicht geändert werden.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!userFormData.name || !userFormData.password) {
      toast({
        title: "Fehler",
        description: "Bitte fülle alle Felder aus.",
        variant: "destructive",
      });
      return;
    }

    if (userFormData.password.length < 6) {
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 6 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch("/api/users", {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          name: userFormData.name.trim(),
          password: userFormData.password,
          role: userFormData.role
        }),
      });

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: "Benutzer erfolgreich erstellt.",
        });
        setIsCreateUserDialogOpen(false);
        setUserFormData({ name: "", password: "", role: "User" });
        refetchUsers();
      } else {
        const errorData = await response.json();
        toast({
          title: "Fehler",
          description: errorData.error || "Fehler beim Erstellen des Benutzers.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Fehler",
        description: "Netzwerkfehler beim Erstellen des Benutzers.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!editUserId || !userFormData.name) {
      toast({
        title: "Fehler",
        description: "Bitte fülle alle erforderlichen Felder aus.",
        variant: "destructive",
      });
      return;
    }

    if (userFormData.password && userFormData.password.length < 6) {
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 6 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const updateData: any = {
        name: userFormData.name.trim(),
        role: userFormData.role
      };

      // Only include password if it's not empty
      if (userFormData.password && userFormData.password.trim()) {
        updateData.password = userFormData.password.trim();
      }

      const response = await fetch(`/api/users/${editUserId}`, {
        method: "PUT",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: "Benutzer erfolgreich aktualisiert.",
        });
        setIsEditUserDialogOpen(false);
        setEditUserId(null);
        setUserFormData({ name: "", password: "", role: "User" });
        refetchUsers();
      } else {
        const errorData = await response.json();
        toast({
          title: "Fehler",
          description: errorData.error || "Fehler beim Aktualisieren des Benutzers.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Fehler",
        description: "Netzwerkfehler beim Aktualisieren des Benutzers.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "DELETE",
        credentials: 'include',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: "Benutzer wurde erfolgreich gelöscht.",
        });
        setIsDeleteUserDialogOpen(false);
        setSelectedUser(null);
        refetchUsers();
      } else {
        const error = await response.json();
        toast({
          title: "Fehler",
          description: error.error || "Benutzer konnte nicht gelöscht werden.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-semibold">Einstellungen</h1>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="account" className="w-full">
          <TabsList className={`grid w-full ${!hideUserManagement && user?.role === "Admin" ? "grid-cols-3" : "grid-cols-1"}`}>
            <TabsTrigger value="account">Kontodaten</TabsTrigger>
            {!hideUserManagement && user?.role === "Admin" && (
              <>
                <TabsTrigger value="users">Benutzerverwaltung</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            {/* Name Change */}
            <Card>
              <CardHeader>
                <CardTitle>Name ändern</CardTitle>
                <CardDescription>
                  Ändere deinen Anzeigenamen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleNameChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-name">Neuer Name</Label>
                    <Input
                      id="new-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      data-testid="input-new-name"
                    />
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Wird geändert..." : "Name ändern"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle>Passwort ändern</CardTitle>
                <CardDescription>
                  Ändere dein Passwort für mehr Sicherheit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Aktuelles Passwort</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pr-10"
                        data-testid="input-current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">Neues Passwort</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                        data-testid="input-new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Neues Passwort bestätigen</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10"
                        data-testid="input-confirm-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    data-testid="button-change-password"
                  >
                    {isLoading ? "Wird geändert..." : "Passwort ändern"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab (Admin only) */}
          {!hideUserManagement && user?.role === "Admin" && (
            <TabsContent value="branding" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Branding Einstellungen</CardTitle>
                  <CardDescription>
                    Passe den Firmennamen an, der in der gesamten Anwendung angezeigt wird
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBrandingUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Firmenname</Label>
                      <Input
                        id="company-name"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="z.B. Mustermann Fotografie"
                        data-testid="input-company-name"
                      />
                      <p className="text-sm text-muted-foreground">
                        Dieser Name erscheint im Browser-Tab und in der Anwendung
                      </p>
                    </div>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Wird gespeichert..." : "Speichern"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* User Management Tab (Admin only) */}
          {!hideUserManagement && user?.role === "Admin" && (
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Benutzerverwaltung</CardTitle>
                      <CardDescription>
                        Verwalte alle Benutzer des Systems
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        setUserFormData({ name: "", password: "", role: "User" });
                        setIsCreateUserDialogOpen(true);
                      }}
                      data-testid="button-create-user"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Benutzer anlegen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.map((u: User) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-sm text-muted-foreground">{u.role}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setUserFormData({
                                name: u.name,
                                password: "", // Clear password on edit
                                role: u.role,
                              });
                              setEditUserId(u.id); // Set the ID of the user being edited
                              setIsEditUserDialogOpen(true);
                            }}
                          >
                            Bearbeiten
                          </Button>
                          {u.id !== user?.id && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(u);
                                setIsDeleteUserDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Create User Dialog */}
        <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Benutzer anlegen</DialogTitle>
              <DialogDescription>
                Erstelle einen neuen Benutzer
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Name</Label>
                <Input
                  id="user-name"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Passwort</Label>
                <div className="relative">
                  <Input
                    id="user-password"
                    type={showUserPassword ? "text" : "password"}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                  >
                    {showUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Rolle</Label>
                <select
                  id="user-role"
                  className="w-full px-3 py-2 border rounded-md"
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateUserDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreateUser}>Erstellen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Benutzer bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeite die Benutzerdaten
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-user-name">Name</Label>
                <Input
                  id="edit-user-name"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-password">Neues Passwort (optional)</Label>
                <div className="relative">
                  <Input
                    id="edit-user-password"
                    type={showUserPassword ? "text" : "password"}
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="pr-10"
                    placeholder="Leer lassen, um nicht zu ändern"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowUserPassword(!showUserPassword)}
                  >
                    {showUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Rolle</Label>
                <select
                  id="edit-user-role"
                  className="w-full px-3 py-2 border rounded-md"
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsEditUserDialogOpen(false);
                setEditUserId(null); // Clear the edit user ID
              }}>
                Abbrechen
              </Button>
              <Button onClick={handleEditUser}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <AlertDialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchtest du den Benutzer "{selectedUser?.name}" wirklich löschen?
                Diese Aktion kann nicht rückgängig gemacht werden. Alle zugewiesenen Galerien werden ebenfalls entfernt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}