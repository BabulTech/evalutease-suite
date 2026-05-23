import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { drawParticipant, drawHost } from "./share-result-card/canvasUtils";
import { participantText, hostText } from "./share-result-card/shareText";
import { SharePanel } from "./share-result-card/SharePanel";
export type { ParticipantShareData, HostShareData } from "./share-result-card/types";
import type { ParticipantShareData, HostShareData } from "./share-result-card/types";

type Props = ParticipantShareData | HostShareData;

export function ShareResultCard(props: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const text = props.mode === "participant" ? participantText(props) : hostText(props);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    if (props.mode === "participant") drawParticipant(canvasRef.current, props);
    else drawHost(canvasRef.current, props);
  }, [open, props]);

  const getDataUrl = () => {
    const c = canvasRef.current!;
    if (props.mode === "participant") drawParticipant(c, props);
    else drawHost(c, props);
    return c.toDataURL("image/png");
  };

  const download = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        const a = document.createElement("a");
        a.href = getDataUrl();
        a.download = `result-${Date.now()}.png`;
        a.click();
        toast.success("Image saved! Attach it when you post.");
      } catch {
        toast.error("Could not generate image");
      }
      setBusy(false);
    }, 50);
  };

  const nativeShare = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(getDataUrl())).blob();
      const file = new File([blob], "result.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Quiz Result", text });
      } else {
        await navigator.share({ title: "Quiz Result", text, url: window.location.href });
      }
    } catch {
      /* cancelled */
    }
    setBusy(false);
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Post text copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-primary/15 p-1.5">
            <Share2 className="size-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Share Result</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            - let everyone know!
          </span>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <SharePanel
          canvasRef={canvasRef}
          text={text}
          copied={copied}
          busy={busy}
          onDownload={download}
          onNativeShare={() => void nativeShare()}
          onCopyText={() => void copyText()}
        />
      )}
    </div>
  );
}
