import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function LoginForm() {
  const [nameOrEmail, setNameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [regError, setRegError] = useState("");

  // Check if initial setup is needed
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/setup/status');
        if (response.ok) {
          const data = await response.json();
          if (data.needsSetup) {
            navigate('/setup');
          }
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
      }
    };
    
    checkSetup();
  }, [navigate]);

  // Check if registration is enabled
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const response = await fetch('/api/auth/registration-status');
        if (response.ok) {
          const data = await response.json();
          setRegistrationEnabled(data.enabled);
        }
      } catch (error) {
        console.error('Error checking registration status:', error);
      }
    };
    checkRegistration();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/galleries');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await login(nameOrEmail, password);
      if (!result.success) {
        const errorMessage = result.error || "Ungültiger Name/E-Mail oder Passwort";
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Anmeldung fehlgeschlagen",
          description: errorMessage,
        });
      } else {
        // Successful login - navigate to galleries
        navigate('/galleries');
      }
    } catch (err) {
      const errorMessage = "Ein Fehler ist aufgetreten";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Anmeldung fehlgeschlagen",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setRegError("");

    // Client-side validation
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setRegError("Alle Felder sind erforderlich");
      setIsLoading(false);
      return;
    }
    if (regPassword.length < 6) {
      setRegError("Passwort muss mindestens 6 Zeichen lang sein");
      setIsLoading(false);
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setRegError("Passwörter stimmen nicht überein");
      setIsLoading(false);
      return;
    }
    if (!regEmail.includes("@")) {
      setRegError("Bitte eine gültige E-Mail-Adresse eingeben");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRegError(data.error || "Registrierung fehlgeschlagen");
        return;
      }

      toast({
        title: "Registrierung erfolgreich",
        description: "Dein Konto wurde erstellt. Bitte melde dich jetzt an.",
      });

      // Switch back to login form
      setIsRegistering(false);
    } catch (err) {
      setRegError("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  };

  // Registration view
  if (isRegistering) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Konto erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Name (öffentlich sichtbar)"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  data-testid="input-register-name"
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="E-Mail"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  data-testid="input-register-email"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Passwort (mind. 6 Zeichen)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-register-password"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Passwort bestätigen"
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-register-password-confirm"
                />
              </div>
              {regError && (
                <p className="text-sm text-destructive" data-testid="text-register-error">
                  {regError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? "Registrieren..." : "Registrieren"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full text-sm text-muted-foreground"
                onClick={() => {
                  setIsRegistering(false);
                  setRegError("");
                }}
              >
                Bereits ein Konto? Anmelden
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Login view
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Anmelden</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Name oder E-Mail"
                value={nameOrEmail}
                onChange={(e) => setNameOrEmail(e.target.value)}
                required
                data-testid="input-name"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="text-error">
                {error}
              </p>
            )}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Anmelden..." : "Anmelden"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full text-sm text-muted-foreground"
              onClick={() => window.location.href = '/forgot-password'}
            >
              Passwort vergessen?
            </Button>
            {registrationEnabled && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">oder</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsRegistering(true)}
                  data-testid="button-goto-register"
                >
                  Neues Konto erstellen
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}