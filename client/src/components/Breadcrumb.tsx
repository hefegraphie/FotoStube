import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  label: string;
  onClick: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="flex items-center space-x-2 text-sm">
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          {index < items.length - 1 ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto font-medium hover:underline"
                onClick={item.onClick}
                data-testid={`breadcrumb-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Button>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </>
          ) : (
            <span className="text-muted-foreground" data-testid="breadcrumb-current">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}