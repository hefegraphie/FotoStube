import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import SelectionPanel from "./SelectionPanel";
import { Download } from "lucide-react"; // Assuming Download icon is used

// Define FilterState type if it's not globally available
type FilterState = {
  showOnlyLiked: boolean;
  showOnlyRated: boolean;
  minStars: number;
  maxStars: number;
};

// Define Photo type if it's not globally available
type Photo = {
  id: string;
  src: string;
  alt: string;
  rating: number;
};

interface CollapsibleSelectionPanelProps {
  selectedPhotos: Photo[];
  onClearSelection: () => void;
  onRatingChange: (rating: number) => void;
  onRemoveFromSelection: (photoId: string) => void;
  onDeleteSelected?: () => void;
  onSelectAll?: () => void;
  onDownloadSelected?: () => void;
  onDownloadAll?: () => void;
  filters?: FilterState;
  onFiltersChange?: (filters: FilterState) => void;
  showFilters?: boolean;
}

export default function CollapsibleSelectionPanel({
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
}: CollapsibleSelectionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Listen for custom toggle events from header buttons
  useEffect(() => {
    const handleToggle = () => setIsOpen(!isOpen);
    window.addEventListener('toggleSelectionPanel', handleToggle);
    return () => window.removeEventListener('toggleSelectionPanel', handleToggle);
  }, [isOpen]);

  // Export toggle button component for use in headers
  const ToggleButton = () => (
    <Button
      variant="default"
      size="icon"
      className="md:hidden shadow-lg bg-primary hover:bg-primary/90"
      onClick={() => setIsOpen(!isOpen)}
      data-testid="toggle-selection-panel"
    >
      {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
    </Button>
  );

  return (
    <>
      {/* Desktop Selection Panel - Always visible */}
      <div className="hidden md:block">
        <SelectionPanel
          selectedPhotos={selectedPhotos}
          onClearSelection={onClearSelection}
          onRatingChange={onRatingChange}
          onRemoveFromSelection={onRemoveFromSelection}
          onDeleteSelected={onDeleteSelected}
          onSelectAll={onSelectAll}
          onDownloadSelected={onDownloadSelected}
          onDownloadAll={onDownloadAll}
          filters={filters}
          onFiltersChange={onFiltersChange}
          showFilters={showFilters}
        />
      </div>

      {/* Mobile Selection Panel - Collapsible overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-80 max-w-[90vw] bg-background border-l shadow-xl">
            <SelectionPanel
              selectedPhotos={selectedPhotos}
              onClearSelection={onClearSelection}
              onRatingChange={onRatingChange}
              onRemoveFromSelection={onRemoveFromSelection}
              onDeleteSelected={onDeleteSelected}
              onSelectAll={onSelectAll}
              onDownloadSelected={onDownloadSelected}
              onDownloadAll={onDownloadAll}
              filters={filters}
              onFiltersChange={onFiltersChange}
              showFilters={showFilters}
            />
          </div>
        </div>
      )}
    </>
  );
}

// Export the toggle button component
CollapsibleSelectionPanel.ToggleButton = function ToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="default"
      size="icon"
      className="md:hidden shadow-lg bg-primary hover:bg-primary/90"
      onClick={onClick}
      data-testid="toggle-selection-panel"
    >
      <Menu className="w-4 h-4" />
    </Button>
  );
};
