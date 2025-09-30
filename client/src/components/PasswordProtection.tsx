
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

interface PasswordProtectionProps {
  galleryName: string;
  onPasswordSubmit: (password: string) => void;
  error?: string;
  loading?: boolean;
}

export default function PasswordProtection({ 
  galleryName, 
  onPasswordSubmit, 
  error, 
  loading = false 
}: PasswordProtectionProps) {
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onPasswordSubmit(password.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Lock className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Passwort erforderlich</CardTitle>
          <CardDescription>
            Die Galerie "{galleryName}" ist passwortgeschützt. Bitte gib das Passwort ein, um fortzufahren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Galerie-Passwort eingeben"
                autoFocus
                disabled={loading}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !password.trim()}
            >
              {loading ? "Überprüfe..." : "Zugang gewähren"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
