import { Image as ImageIcon } from "lucide-react";
import type { RefObject } from "react";

type Props = {
  imageUrl: string | null;
  imageName: string;
  fileRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
};

export function ImageUploadZone({ imageUrl, imageName, fileRef, onFile }: Props) {
  return (
    <div className="space-y-2">
      <label
        className="relative rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 min-h-[260px] flex items-center justify-center overflow-hidden transition-colors cursor-pointer"
        aria-label="Upload quiz image"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={imageName} className="max-h-[420px] w-full object-contain" />
        ) : (
          <div className="text-center p-6">
            <ImageIcon className="mx-auto size-10 text-muted-foreground/60" />
            <div className="mt-3 text-sm font-medium">Click to upload an image</div>
            <div className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, GIF, or WebP - up to 5 MB
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          aria-label="Upload quiz image"
          className="sr-only"
          title="Upload quiz image"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
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
