import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { createRoot } from "react-dom/client";

type Props = {
  message: string;
  onClose: () => void;
};

function ValidationPopup({ message, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto-close after 3.5s
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 250);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
      aria-live="assertive"
    >
      <div
        className={`pointer-events-auto flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 backdrop-blur-md px-5 py-4 shadow-2xl max-w-sm w-full mx-4 transition-all duration-200 ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <p className="flex-1 text-sm font-medium text-destructive leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 text-destructive/60 hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Imperative API — call anywhere like: validationError("Name is required")
export function validationError(message: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const cleanup = () => {
    root.unmount();
    container.remove();
  };

  root.render(<ValidationPopup message={message} onClose={cleanup} />);
}
