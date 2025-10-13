
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export default function LoadingOverlay({ isVisible, message = "Bilder werden bewertet..." }: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-lg p-8 shadow-2xl flex flex-col items-center space-y-4">
        {/* Hourglass Animation */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 animate-spin">
            <svg
              className="w-16 h-16 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 2v4m0 12v4M6 12H2m20 0h-4m-1.05-7.05l-2.83 2.83m0 8.44l2.83 2.83M7.05 4.95l2.83 2.83m0 8.44l-2.83 2.83"
              />
            </svg>
          </div>
        </div>

        {/* Message */}
        <p className="text-lg font-medium text-foreground">{message}</p>
        
        {/* Progress dots animation */}
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
}
