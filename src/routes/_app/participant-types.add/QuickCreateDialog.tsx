import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function QuickCreateDialog({
  open,
  onClose,
  title,
  placeholder,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  placeholder: string;
  onConfirm: (name: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = value.trim();
    if (!name) {
      toast.error(t("ptAdd.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      await onConfirm(name);
      setValue("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

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
          <Label className="mb-1.5">{t("ptAdd.name")}</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
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
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? t("common.saving") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
