import { createRoot } from "react-dom/client";
import { ValidationPopup } from "./ValidationPopup";

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
