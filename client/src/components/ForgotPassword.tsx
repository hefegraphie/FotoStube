
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: "E-Mail gesendet",
          description: data.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.error || "Ein Fehler ist aufgetreten",
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Passwort vergessen</CardTitle>
          <CardDescription className="text-center">
            Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Wir haben dir eine E-Mail mit einem Link zum Zurücksetzen deines Passworts gesendet.
                Bitte überprüfe dein Postfach.
              </p>
              <Button 
                className="w-full" 
                onClick={() => window.location.href = '/login'}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zur Anmeldung
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="E-Mail-Adresse"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "Wird gesendet..." : "Reset-Link senden"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => window.location.href = '/login'}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zur Anmeldung
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
