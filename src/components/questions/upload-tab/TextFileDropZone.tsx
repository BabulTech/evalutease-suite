import { FileText } from "lucide-react";
import type { RefObject } from "react";

const ACCEPTED = ".txt,.md,.csv,text/plain";

type Props = {
  filename: string;
  fileRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
};

export function TextFileDropZone({ filename, fileRef, onFile }: Props) {
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        title="Upload a text file"
        aria-label="Upload a text file"
      />
      <button
        type="button"
        className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 p-8 text-center transition-colors cursor-pointer w-full"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        <FileText className="mx-auto size-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium">
          {filename ? `Loaded: ${filename}` : "Click to choose a text file"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {filename ? "Click to replace, or edit the content below." : "Up to 1 MB"}
        </div>
      </button>
    </>
  );
}
