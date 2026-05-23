import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";

type Props = {
  message: string;
  onClose: () => void;
};

export function ValidationPopup({ message, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10);
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 250);
    }, 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
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
        <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
        <p className="flex-1 text-sm font-medium text-destructive leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 text-destructive/60 hover:text-destructive transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
