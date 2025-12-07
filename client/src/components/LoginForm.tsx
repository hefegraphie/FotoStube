
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
