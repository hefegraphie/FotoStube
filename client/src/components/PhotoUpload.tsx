
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PhotoUploadProps {
  isOpen: boolean;
  onClose: () => void;
  galleryId: string;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  alt: string;
  preview: string;
}

export default function PhotoUpload({ isOpen, onClose, galleryId, onUploadComplete }: PhotoUploadProps) {
  const { user } = useAuth();
  const isAdminOrCreator = user?.role === "Admin" || user?.role === "Creator";
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        setUploadFiles(prev => [...prev, {
          file,
          alt: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for default alt
          preview
        }]);
      }
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const updateAlt = (index: number, alt: string) => {
    setUploadFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, alt } : file
    ));
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte wählen Sie mindestens eine Datei aus."
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Always use multiple upload endpoint for consistency
      const formData = new FormData();
      uploadFiles.forEach(({ file }) => {
        formData.append('photos', file);
      });
      formData.append('alts', JSON.stringify(uploadFiles.map(f => f.alt)));
      formData.append('userId', user?.id || '');
      // Create XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Promise wrapper for XMLHttpRequest
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || 'Upload fehlgeschlagen'));
            } catch (e) {
              reject(new Error('Upload fehlgeschlagen'));
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error('Netzwerkfehler beim Upload'));
        };

        xhr.open('POST', `/api/galleries/${galleryId}/photos/upload-multiple`);
        xhr.send(formData);
      });

      await uploadPromise;

      // Clean up previews
      uploadFiles.forEach(file => URL.revokeObjectURL(file.preview));
      setUploadFiles([]);

      toast({
        title: "Erfolg",
        description: `${uploadFiles.length} Foto${uploadFiles.length > 1 ? 's' : ''} erfolgreich hochgeladen.`
      });

      onUploadComplete();
      onClose(); // Close dialog after successful upload
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error instanceof Error ? error.message : "Fehler beim Hochladen der Fotos."
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Fotos hochladen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
        {/* File Input */}
        <div>
          <Label htmlFor="photo-upload">Fotos auswählen</Label>
          <input
            ref={fileInputRef}
            id="photo-upload"
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full mt-2"
            disabled={isUploading}
          >
            <Plus className="w-4 h-4 mr-2" />
            Fotos hinzufügen
          </Button>
        </div>

        {/* Preview List */}
        {uploadFiles.length > 0 && (
          <div className="space-y-3">
            <Label>Ausgewählte Fotos ({uploadFiles.length})</Label>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {uploadFiles.map((uploadFile, index) => (
                <div key={index} className="flex items-center gap-3 p-2 border rounded">
                  <img
                    src={uploadFile.preview}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="flex-1">
                    <Input
                      value={uploadFile.alt}
                      onChange={(e) => updateAlt(index, e.target.value)}
                      placeholder="Bildunterschrift"
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {uploadFile.file.name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm">Upload-Fortschritt</Label>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* Upload Button */}
        {uploadFiles.length > 0 && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            variant="secondary"
            className="w-full btn-green"
          >
            {isUploading ? `Lade hoch... (${uploadProgress}%)` : `${uploadFiles.length} Foto${uploadFiles.length > 1 ? 's' : ''} hochladen`}
          </Button>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
