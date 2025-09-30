import ThemeToggle from "../ThemeToggle";

export default function ThemeToggleExample() {
  return (
    <div className="p-4">
      <div className="flex items-center space-x-4">
        <span className="text-sm text-muted-foreground">Toggle theme:</span>
        <ThemeToggle />
      </div>
    </div>
  );
}