import { Share2, Download, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORMS } from "./shareText";

type Props = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  text: string;
  copied: boolean;
  busy: boolean;
  onDownload: () => void;
  onNativeShare: () => void;
  onCopyText: () => void;
};

export function SharePanel({
  canvasRef,
  text,
  copied,
  busy,
  onDownload,
  onNativeShare,
  onCopyText,
}: Props) {
  return (
    <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Share image preview</p>
        <div className="rounded-xl overflow-hidden border border-border">
          <canvas ref={canvasRef} className="w-full block" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/10 px-4 py-3">
        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Post caption</p>
        <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {text}
        </pre>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Button
          size="sm"
          onClick={onDownload}
          disabled={busy}
          className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer"
        >
          <Download className="size-3.5" />
          {busy ? "Generating…" : "Download Image"}
        </Button>
        {"share" in navigator && (
          <Button
            size="sm"
            variant="outline"
            onClick={onNativeShare}
            disabled={busy}
            className="gap-1.5 cursor-pointer"
          >
            <Share2 className="size-3.5" /> Share via…
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onCopyText}
          className="gap-1.5 ml-auto cursor-pointer"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Link2 className="size-3.5" />}
          {copied ? "Copied!" : "Copy caption"}
        </Button>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium">Post to platform</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => window.open(p.url(text), "_blank", "noopener,width=620,height=520")}
              className={`flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-xs font-medium transition-all duration-200 cursor-pointer ${p.cls}`}
            >
              <p.icon className="size-4 shrink-0" />
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          💡 Download the image first, then attach it to your post for the best visual result.
        </p>
      </div>
    </div>
  );
}
