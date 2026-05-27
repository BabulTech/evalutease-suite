import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { DraftReview } from "./DraftReview";
import { extractQuestionsFromImage } from "./ai.server";
import { type DraftQuestion, type Difficulty } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/contexts/PlanContext";
import { UpgradePrompt } from "./scan-tab/UpgradePrompt";
import { ImageUploadZone } from "./scan-tab/ImageUploadZone";
import { ScanHeader } from "./scan-tab/ScanHeader";
import { ScanControls } from "./scan-tab/ScanControls";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const SUPPORTED: SupportedMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  saving: boolean;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function ScanTab({ disabled, onSave, saving }: Props) {
  const { plan, credits, reload, isAiAllowed } = usePlan();
  const isFreeAi = plan?.slug === "enterprise_free";
  const freeAiLimit = plan?.trial_ai_calls ?? 10;
  const [freeAiUsed, setFreeAiUsed] = useState<number | null>(null);
  useEffect(() => {
    if (!isFreeAi) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("trial_ai_usage")
      .select("used_calls")
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setFreeAiUsed(data?.used_calls ?? 0));
  }, [isFreeAi]);
  const freeAiExhausted = isFreeAi && freeAiUsed !== null && freeAiUsed >= freeAiLimit;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const mediaTypeRef = useRef<SupportedMediaType | null>(null);
  const [hint, setHint] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const creditCost = plan?.credit_cost_ai_scan ?? 2;

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
    mediaTypeRef.current = file.type as SupportedMediaType;

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
    if (!imageBase64 || !mediaTypeRef.current) {
      toast.error("Upload an image first.");
      return;
    }
    if (credits.balance < creditCost) {
      toast.error(
        `Not enough credits. Need ${creditCost}, you have ${credits.balance}. Buy more in Billing.`,
      );
      return;
    }
    setExtracting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in again to use AI features.");
        return;
      }
      const out = await extractQuestionsFromImage({
        data: {
          imageBase64,
          mediaType: mediaTypeRef.current,
          hint: hint.trim(),
          difficulty,
          _token: session.access_token,
        },
      });
      if (out.length === 0) {
        toast.error("Claude couldn't find any questions in the image. Try a clearer scan.");
        return;
      }
      setDrafts(out);
      reload();
      toast.success(
        `Extracted ${out.length} question${out.length === 1 ? "" : "s"} · ${creditCost} credits used`,
      );
    } catch (err) {
      toast.error((err as Error)?.message ?? "Image extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  if (!isAiAllowed) return <UpgradePrompt />;
  // Lock scan once enterprise_free users exhaust their lifetime AI allowance
  if (freeAiExhausted) return <UpgradePrompt />;

  return (
    <div className="space-y-5">
      <ScanHeader creditsBalance={credits.balance} creditCost={creditCost} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
            Image
          </Label>
          <ImageUploadZone
            imageUrl={imageUrl}
            imageName={imageName}
            fileRef={fileRef}
            onFile={handleFile}
          />
        </div>
        <ScanControls
          hint={hint}
          setHint={setHint}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          fileRef={fileRef}
          extracting={extracting}
          disabled={disabled}
          hasImage={!!imageBase64}
          hasEnoughCredits={credits.balance >= creditCost}
          creditCost={creditCost}
          onExtract={extract}
        />
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
