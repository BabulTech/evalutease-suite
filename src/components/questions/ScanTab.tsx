import { useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DraftReview } from "./DraftReview";
import { extractQuestionsFromImage } from "./ai.server";
import { type DraftQuestion, type Difficulty } from "./types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const SUPPORTED: SupportedMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  saving: boolean;
};

export function ScanTab({ disabled, onSave, saving }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [mediaType, setMediaType] = useState<SupportedMediaType | null>(null);
  const [hint, setHint] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!SUPPORTED.includes(file.type as SupportedMediaType)) {
      toast.error("Please choose a JPG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setImageName(file.name);
    setMediaType(file.type as SupportedMediaType);

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      setImageBase64(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => toast.error("Could not read the image file.");
    reader.readAsDataURL(file);
  };

  const extract = async () => {
    if (!imageBase64 || !mediaType) {
      toast.error("Upload an image first.");
      return;
    }
    setExtracting(true);
    try {
      const out = await extractQuestionsFromImage({
        data: { imageBase64, mediaType, hint: hint.trim(), difficulty },
      });
      if (out.length === 0) {
        toast.error("Claude couldn't find any questions in the image. Try a clearer scan.");
        return;
      }
      setDrafts(out);
      toast.success(
        `Extracted ${out.length} question${out.length === 1 ? "" : "s"} — review before saving`,
      );
    } catch (err) {
      const msg = (err as Error)?.message ?? "Image extraction failed";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <ScanLine className="h-4 w-4" /> Scan an image with Claude
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a photo or screenshot of a question paper — printed, handwritten, or formatted any
          way you like. Claude will read the page and turn each question it finds into an editable
          MCQ draft. No fixed format required.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Image</Label>
          <div
            className="relative rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 min-h-[260px] flex items-center justify-center overflow-hidden transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            role="button"
          >
            {imageUrl ? (
              <img src={imageUrl} alt={imageName} className="max-h-[420px] w-full object-contain" />
            ) : (
              <div className="text-center p-6">
                <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/60" />
                <div className="mt-3 text-sm font-medium">Click to upload an image</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, GIF, or WebP — up to 5 MB
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
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

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Notes for Claude (optional)
          </Label>
          <Textarea
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder={
              "Anything Claude should know about the page — e.g. 'class 10 physics, Urdu medium', 'second column only', 'correct answers are circled'…"
            }
            className="min-h-[160px] text-sm"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                Default difficulty
              </Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" /> Image
              </Button>
              <Button
                type="button"
                onClick={extract}
                disabled={extracting || disabled || !imageBase64}
                className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow flex-1"
              >
                <ScanLine className="h-4 w-4" />
                {extracting ? "Reading…" : "Extract questions"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DraftReview
        drafts={drafts}
        setDrafts={setDrafts}
        source="ocr"
        saving={saving || !!disabled}
        onSave={async (d) => {
          await onSave(d);
          setDrafts([]);
          setHint("");
        }}
        onClear={() => setDrafts([])}
      />
    </div>
  );
}
