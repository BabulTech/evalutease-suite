import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAddParticipant } from "./participant-types.add/useAddParticipant";
import { QuickCreateDialog } from "./participant-types.add/QuickCreateDialog";
import { GroupSelector } from "./participant-types.add/GroupSelector";
import { ManualTab } from "./participant-types.add/ManualTab";
import { InviteTab } from "./participant-types.add/InviteTab";
import { UploadTab } from "./participant-types.add/UploadTab";
import { ScanTab } from "./participant-types.add/ScanTab";
import { ExistingTab } from "./participant-types.add/ExistingTab";
import { useState } from "react";
import { Mail, Plus, ScanLine, Upload } from "lucide-react";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/participant-types/add")({
  component: AddParticipantPage,
});

type Method = "manual" | "invite" | "upload" | "scan" | "existing";

// react-doctor-disable-next-line react-doctor/only-export-components
function AddParticipantPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [method, setMethod] = useState<Method>("manual");

  const {
    types,
    subs,
    typeId,
    setTypeId,
    subId,
    setSubId,
    hostSettings,
    createType,
    createSub,
    insertOne,
    insertMany,
    generateInvite,
  } = useAddParticipant(user);

  const METHODS: { value: Method; icon: React.ReactNode; label: string; desc: string }[] = [
    {
      value: "manual",
      icon: <UserPlus className="size-5" />,
      label: t("ptAdd.tabManual"),
      desc: "Fill in details one at a time",
    },
    {
      value: "existing",
      icon: <Plus className="size-5" />,
      label: "From Existing",
      desc: "Re-add from another group",
    },
    {
      value: "invite",
      icon: <Mail className="size-5" />,
      label: t("ptAdd.tabInvite"),
      desc: "Send a self-join link or QR",
    },
    {
      value: "upload",
      icon: <Upload className="size-5" />,
      label: t("ptAdd.tabUpload"),
      desc: "Bulk import from CSV file",
    },
    {
      value: "scan",
      icon: <ScanLine className="size-5" />,
      label: t("ptAdd.tabScan"),
      desc: "Extract from a photo or scan",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <button
          type="button"
          onClick={() => navigate({ to: "/participant-types" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="size-3.5" /> {t("ptAdd.backTo")}
        </button>
        <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <UserPlus className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {t("ptAdd.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("ptAdd.desc")}</p>
          </div>
        </div>
      </div>

      <GroupSelector
        types={types}
        subs={subs}
        typeId={typeId}
        subId={subId}
        onTypeChange={(v) => {
          setTypeId(v);
          setSubId("");
        }}
        onSubChange={setSubId}
        onNewType={() => setCreateTypeOpen(true)}
        onNewSub={() => setCreateSubOpen(true)}
      />

      <div
        className={`rounded-2xl border border-border bg-card/50 p-5 space-y-4 transition-opacity ${!typeId ? "opacity-50 pointer-events-none" : ""}`}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            2
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("ptAdd.step2")}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all min-h-[88px] ${
                method === m.value
                  ? "border-primary bg-primary/10 text-primary shadow-glow"
                  : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {m.icon}
              <span className="text-xs font-semibold leading-tight">{m.label}</span>
              <span className="text-[10px] leading-tight opacity-70 hidden sm:block">{m.desc}</span>
            </button>
          ))}
        </div>

        <div className="pt-2 border-t border-border">
          {method === "manual" && (
            <ManualTab
              typeId={typeId}
              hostSettings={hostSettings}
              ownerId={user?.id ?? ""}
              onSave={async (d) => {
                await insertOne(d, subId);
                toast.success(t("pt.participantAdded").replace("{name}", d.name));
              }}
            />
          )}
          {method === "invite" && (
            <InviteTab subId={subId} onGenerate={(pt) => generateInvite(subId, pt)} />
          )}
          {method === "upload" && (
            <UploadTab typeId={typeId} onSave={(drafts) => insertMany(drafts, subId)} />
          )}
          {method === "scan" && (
            <ScanTab typeId={typeId} onSave={(drafts) => insertMany(drafts, subId)} />
          )}
          {method === "existing" && <ExistingTab ownerId={user?.id ?? ""} subId={subId} />}
        </div>
      </div>

      <QuickCreateDialog
        open={createTypeOpen}
        onClose={() => setCreateTypeOpen(false)}
        title={t("ptAdd.newTypeTitle")}
        placeholder={t("ptAdd.newTypePlaceholder")}
        onConfirm={createType}
      />
      <QuickCreateDialog
        open={createSubOpen}
        onClose={() => setCreateSubOpen(false)}
        title={t("ptAdd.newGroupTitle")}
        placeholder={t("ptAdd.newGroupPlaceholder")}
        onConfirm={(name) => createSub(name, typeId)}
      />
    </div>
  );
}
