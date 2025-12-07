
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function GalleryNotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Galerie nicht gefunden
            </h1>
          </div>

          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
            Die angeforderte Galerie existiert nicht oder Sie haben keine Berechtigung, diese anzuzeigen.
          </p>

          <Button 
            onClick={() => navigate("/galleries")}
            className="w-full"
          >
            Zurück zur Galerieübersicht
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
