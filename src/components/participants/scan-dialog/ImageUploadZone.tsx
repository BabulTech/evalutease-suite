import { Image as ImageIcon } from "lucide-react";
import type { RefObject } from "react";

type Props = {
  imageUrl: string | null;
  imageName: string;
  fileRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
  minHeight?: string;
};

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

export function ImageUploadZone({
  imageUrl,
  imageName,
  fileRef,
  onFile,
  minHeight = "min-h-[220px]",
}: Props) {
  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        title="Upload image"
        aria-label="Upload image"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className={`relative rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 ${minHeight} flex items-center justify-center overflow-hidden transition-colors cursor-pointer w-full`}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        aria-label="Click to upload image"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={imageName} className="max-h-[360px] w-full object-contain" />
        ) : (
          <div className="text-center p-6">
            <ImageIcon className="mx-auto size-10 text-muted-foreground/60" />
            <div className="mt-3 text-sm font-medium">Click to upload an image</div>
            <div className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, GIF, or WebP - up to 5 MB
            </div>
          </div>
        )}
      </button>
      {imageUrl && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{imageName}</span>
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => fileRef.current?.click()}
          >
            Replace
          </button>
        </div>
      )}
    </div>
  );
}
