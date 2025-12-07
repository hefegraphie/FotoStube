import { Star, X, Trash2, Filter, Heart, Download, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface FilterState {
  showOnlyLiked: boolean;
  showOnlyRated: boolean;
  minStars: number;
  maxStars: number;
}

interface SelectionPanelProps {
  selectedPhotos: Array<{
    id: string;
    src: string;
    alt: string;
    rating: number;
  }>;
  onClearSelection: () => void;
  onRatingChange: (rating: number, userName?: string) => void;
  onRemoveFromSelection: (photoId: string) => void;
  onDeleteSelected?: () => void;
  onSelectAll?: () => void;
  onDownloadSelected?: () => void;
  onDownloadAll?: () => void;
  filters?: FilterState;
  onFiltersChange?: (filters: FilterState) => void;
  showFilters?: boolean;
}

export default function SelectionPanel({
  selectedPhotos,
  onClearSelection,
  onRatingChange,
  onRemoveFromSelection,
  onDeleteSelected,
  onSelectAll,
  onDownloadSelected,
  onDownloadAll,
  filters,
  onFiltersChange,
  showFilters = true
}: SelectionPanelProps) {
  const [showFilenamesDialog, setShowFilenamesDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'captureone' | 'lightroom'>('captureone');
  
  // Try to get user from auth context, but make it optional for public galleries
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch (error) {
    // Not in auth context (public gallery), user remains null
  }

  const isDelete = user?.role === "Admin" || user?.role === "Creator";
  
  const getFormattedFilenames = () => {
    return exportFormat === 'captureone' 
      ? selectedPhotos.map(photo => photo.alt).join(' ')
      : selectedPhotos.map(photo => photo.alt).join(', ');
  };
  
  const copyToClipboard = () => {
    const filenames = selectedPhotos.map(photo => photo.alt).join(' ');
    navigator.clipboard.writeText(filenames).then(() => {
      setShowFilenamesDialog(false);
    });
  };
  const handleFilterChange = (key: keyof FilterState, value: any) => {
    if (filters && onFiltersChange) {
      onFiltersChange({
        ...filters,
        [key]: value
      });
    }
  };

  if (selectedPhotos.length === 0 && !showFilters) {
    return (
      <div className="w-80 bg-card border-l p-6">
        <div className="text-center text-muted-foreground">
          <p>Keine Bilder ausgewählt</p>
          <p className="text-sm mt-2">
            Klicken Sie auf den Auswahlbutton oben rechts auf einem Bild
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-card border-l p-6 relative z-30 overflow-y-auto h-screen flex flex-col" data-testid="selection-panel">
      {/* Download All Section */}
      {onDownloadAll && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <Button
              onClick={onDownloadAll}
              className="w-full flex items-center space-x-2 bg-primary hover:bg-primary/90"
              data-testid="button-download-all-photos"
            >
              <Download className="w-4 h-4" />
              <span>Alle Bilder herunterladen</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter Section */}
      {showFilters && filters && onFiltersChange && (
        <Card className="mb-4">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Like Filter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm">Nur gelikte Fotos</span>
              </div>
              <Switch
                checked={filters.showOnlyLiked}
                onCheckedChange={(checked) => handleFilterChange('showOnlyLiked', checked)}
                data-testid="filter-liked-switch"
              />
            </div>

            {/* Rating Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">Nur bewertete Fotos</span>
                </div>
                <Switch
                  checked={filters.showOnlyRated}
                  onCheckedChange={(checked) => handleFilterChange('showOnlyRated', checked)}
                  data-testid="filter-rated-switch"
                />
              </div>

              {/* Star Range Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sterne-Bereich</span>
                  <span className="text-sm font-medium">
                    {filters.minStars} - {filters.maxStars} ⭐
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Min. Sterne: {filters.minStars}</label>
                    <Slider
                      value={[filters.minStars]}
                      onValueChange={([value]) => handleFilterChange('minStars', value)}
                      max={5}
                      min={0}
                      step={1}
                      className="mt-1"
                      data-testid="filter-min-stars-slider"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max. Sterne: {filters.maxStars}</label>
                    <Slider
                      value={[filters.maxStars]}
                      onValueChange={([value]) => handleFilterChange('maxStars', value)}
                      max={5}
                      min={filters.minStars}
                      step={1}
                      className="mt-1"
                      data-testid="filter-max-stars-slider"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  // This will be handled by the parent component
                  if (onSelectAll) {
                    onSelectAll();
                  }
                }}
                data-testid="button-select-all"
              >
                {filters && (filters.showOnlyLiked || filters.showOnlyRated)
                  ? "Gefilterte Bilder auswählen"
                  : "Alle Bilder auswählen"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onFiltersChange({
                  showOnlyLiked: false,
                  showOnlyRated: false,
                  minStars: 0,
                  maxStars: 5
                })}
                data-testid="button-reset-filters"
              >
                Filter zurücksetzen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selection Section */}
      {selectedPhotos.length > 0 && (
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg" data-testid="text-selection-count">
                {selectedPhotos.length} Bilder ausgewählt
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearSelection}
                data-testid="button-clear-selection"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 flex-1 flex flex-col">
          {/* Batch Rating */}
          <div>
            <h4 className="font-medium mb-3">Bewertung für alle ausgewählten Bilder</h4>
            <div className="flex items-center space-x-2 mb-2">
              <button
                onClick={() => onRatingChange(0, user?.name)}
                className="hover:scale-110 transition-transform text-muted-foreground hover:text-red-500"
                title="Bewertung löschen"
                data-testid="button-batch-clear-rating"
              >
                <X className="w-6 h-6" />
              </button>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onRatingChange(star, user?.name)}
                  className="hover:scale-110 transition-transform"
                  data-testid={`button-batch-star-${star}`}
                >
                  <Star
                    className="w-6 h-6 text-muted-foreground hover:fill-yellow-400 hover:text-yellow-400"
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Klicken Sie auf einen Stern oder das X, um allen ausgewählten Bildern diese Bewertung zu geben
            </p>
          </div>

          {/* Selected Photos List */}
          <div>
            <h4 className="font-medium mb-3">Ausgewählte Bilder</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="flex items-center space-x-3 p-2 rounded border"
                  data-testid={`selected-photo-${photo.id}`}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {photo.alt}
                    </p>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            star <= photo.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        {photo.rating}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={() => onRemoveFromSelection(photo.id)}
                    data-testid={`button-remove-${photo.id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {onDownloadSelected && (
              <Button
                variant="default"
                className="w-full"
                onClick={onDownloadSelected}
                data-testid="button-download-selected"
              >
                <Download className="w-4 h-4 mr-2" />
                {selectedPhotos.length > 0 
                  ? `${selectedPhotos.length} Foto${selectedPhotos.length > 1 ? 's' : ''} herunterladen`
                  : 'Alle Fotos herunterladen'
                }
              </Button>
            )}
            <Dialog open={showFilenamesDialog} onOpenChange={setShowFilenamesDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="button-show-filenames"
                >
                  Export
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Dateinamen exportieren</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setExportFormat('captureone')}
                      variant={exportFormat === 'captureone' ? 'default' : 'secondary'}
                      className="flex-1"
                      data-testid="format-captureone-button"
                    >
                      Capture One
                    </Button>
                    <Button
                      onClick={() => setExportFormat('lightroom')}
                      variant={exportFormat === 'lightroom' ? 'default' : 'secondary'}
                      className="flex-1"
                      data-testid="format-lightroom-button"
                    >
                      Lightroom
                    </Button>
                  </div>

                  <Textarea
                    value={getFormattedFilenames()}
                    readOnly
                    className="min-h-[120px] resize-none"
                    data-testid="filenames-textarea"
                  />

                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(getFormattedFilenames());
                    }}
                    className="w-full flex items-center gap-2"
                    data-testid="copy-filenames-button"
                  >
                    <Copy className="w-4 h-4" />
                    In Zwischenablage kopieren
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {onDeleteSelected && isDelete && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  if (confirm(`Möchten Sie wirklich ${selectedPhotos.length} Foto${selectedPhotos.length > 1 ? 's' : ''} löschen?`)) {
                    onDeleteSelected();
                  }
                }}
                data-testid="button-delete-selected"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Ausgewählte löschen
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={onClearSelection}
              data-testid="button-clear-all"
            >
              Alle abwählen
            </Button>
          </div>
        </CardContent>
        </Card>
      )}
    </div>
  );
}