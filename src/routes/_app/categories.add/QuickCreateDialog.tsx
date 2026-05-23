import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  placeholder: string;
  onConfirm: (name: string) => Promise<void>;
};

export function QuickCreateDialog({ open, onClose, title, placeholder, onConfirm }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onConfirm(value.trim());
      setValue("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setValue("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div>
          <span className="text-xs text-muted-foreground mb-1.5 block">Name *</span>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="h-11"
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setValue("");
              onClose();
            }}
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !value.trim()}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? t("cat.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
