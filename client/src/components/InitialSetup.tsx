
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InitialSetup() {
  const [step, setStep] = useState<"admin" | "smtp" | "complete">("admin");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if setup is needed on component mount
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch("/api/setup/status");
        const data = await response.json();
        
        if (data.hasUsers) {
          // Redirect to home if users already exist
          navigate("/", { replace: true });
        } else {
          // Setup is needed, show the form
          setIsCheckingSetup(false);
        }
      } catch (error) {
        console.error("Error checking setup status:", error);
        // On error, allow setup to proceed
        setIsCheckingSetup(false);
      }
    };

    checkSetupStatus();
  }, [navigate]);

  // Admin data
  const [adminData, setAdminData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // SMTP data
  const [smtpData, setSmtpData] = useState({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "",
    appUrl: window.location.origin,
  });

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (adminData.password !== adminData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Passwörter stimmen nicht überein",
      });
      return;
    }

    if (adminData.password.length < 6) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Passwort muss mindestens 6 Zeichen lang sein",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/setup/create-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: adminData.name,
          email: adminData.email,
          password: adminData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: "Admin-Benutzer wurde erstellt",
        });
        setStep("smtp");
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.error || "Fehler beim Erstellen des Benutzers",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigureSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/setup/configure-smtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(smtpData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Erfolg",
          description: data.skipped 
            ? "SMTP-Konfiguration übersprungen" 
            : "SMTP wurde erfolgreich konfiguriert",
        });
        setStep("complete");
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.error || "Fehler beim Konfigurieren von SMTP",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipSmtp = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/setup/configure-smtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      
      toast({
        title: "Hinweis",
        description: "SMTP-Konfiguration wurde übersprungen",
      });
      setStep("complete");
    } catch (err) {
      console.error("Error skipping SMTP:", err);
      setStep("complete");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking setup status
  if (isCheckingSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Lade...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {step === "admin" && "Willkommen! Ersteinrichtung"}
            {step === "smtp" && "E-Mail Konfiguration"}
            {step === "complete" && "Setup abgeschlossen"}
          </CardTitle>
          <CardDescription className="text-center">
            {step === "admin" && "Erstelle den ersten Administrator-Account"}
            {step === "smtp" && "Konfiguriere SMTP für E-Mail-Benachrichtigungen (optional)"}
            {step === "complete" && "Die Einrichtung ist abgeschlossen"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "admin" && (
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Benutzername *</Label>
                <Input
                  id="name"
                  type="text"
                  value={adminData.name}
                  onChange={(e) => setAdminData({ ...adminData, name: e.target.value })}
                  required
                  placeholder="z.B. admin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={adminData.email}
                  onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                  required
                  placeholder="z.B. admin@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={adminData.password}
                      onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                      required
                      className="pr-10"
                      placeholder="Mindestens 6 Zeichen"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                      const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
                      const numberChars = '0123456789';
                      const specialChars = '!@#$%^&*';
                      const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
                      
                      let password = '';
                      password += uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
                      password += lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
                      password += numberChars[Math.floor(Math.random() * numberChars.length)];
                      password += specialChars[Math.floor(Math.random() * specialChars.length)];
                      
                      for (let i = 4; i < 12; i++) {
                        password += allChars[Math.floor(Math.random() * allChars.length)];
                      }
                      
                      password = password.split('').sort(() => Math.random() - 0.5).join('');
                      setAdminData({ ...adminData, password, confirmPassword: password });
                    }}
                    className="px-3"
                  >
                    Generieren
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Passwort bestätigen *</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={adminData.confirmPassword}
                  onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                  required
                  placeholder="Passwort wiederholen"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Wird erstellt..." : "Admin-Account erstellen"}
              </Button>
            </form>
          )}

          {step === "smtp" && (
            <form onSubmit={handleConfigureSmtp} className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Die SMTP-Konfiguration ist optional, aber erforderlich für die Passwort-Zurücksetzen-Funktion.
                  Sie können diese auch später in den Einstellungen konfigurieren.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="smtpHost">SMTP Host</Label>
                <Input
                  id="smtpHost"
                  type="text"
                  value={smtpData.smtpHost}
                  onChange={(e) => setSmtpData({ ...smtpData, smtpHost: e.target.value })}
                  placeholder="z.B. smtp.gmail.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPort">SMTP Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={smtpData.smtpPort}
                  onChange={(e) => setSmtpData({ ...smtpData, smtpPort: e.target.value })}
                  placeholder="587"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpUser">SMTP Benutzer</Label>
                <Input
                  id="smtpUser"
                  type="text"
                  value={smtpData.smtpUser}
                  onChange={(e) => setSmtpData({ ...smtpData, smtpUser: e.target.value })}
                  placeholder="z.B. deine-email@beispiel.de"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPassword">SMTP Passwort</Label>
                <div className="relative">
                  <Input
                    id="smtpPassword"
                    type={showSmtpPassword ? "text" : "password"}
                    value={smtpData.smtpPassword}
                    onChange={(e) => setSmtpData({ ...smtpData, smtpPassword: e.target.value })}
                    className="pr-10"
                    placeholder="SMTP Passwort"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  >
                    {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpFrom">SMTP Absender</Label>
                <Input
                  id="smtpFrom"
                  type="text"
                  value={smtpData.smtpFrom}
                  onChange={(e) => setSmtpData({ ...smtpData, smtpFrom: e.target.value })}
                  placeholder="z.B. noreply@beispiel.de"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appUrl">App URL</Label>
                <Input
                  id="appUrl"
                  type="text"
                  value={smtpData.appUrl}
                  onChange={(e) => setSmtpData({ ...smtpData, appUrl: e.target.value })}
                  placeholder="z.B. https://deine-url.de"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Wird konfiguriert..." : "SMTP konfigurieren"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1" 
                  onClick={handleSkipSmtp}
                  disabled={isLoading}
                >
                  Überspringen
                </Button>
              </div>
            </form>
          )}

          {step === "complete" && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Die Ersteinrichtung ist abgeschlossen! Sie können sich jetzt mit Ihren Administrator-Zugangsdaten anmelden.
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-semibold">Ihre Zugangsdaten:</p>
                <p className="text-sm">Benutzername: {adminData.name}</p>
                <p className="text-sm">E-Mail: {adminData.email}</p>
              </div>

              {!smtpData.smtpHost && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Wichtig:</strong> Sie haben SMTP nicht konfiguriert. 
                    Die Passwort-Zurücksetzen-Funktion wird nicht funktionieren. 
                    Sie können SMTP später in den Einstellungen konfigurieren.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                className="w-full" 
                onClick={() => navigate('/login')}
              >
                Zur Anmeldung
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
