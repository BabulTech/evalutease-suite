import { Plus, Search, UsersRound, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ParticipantDialog } from "@/components/participants/ParticipantDialog";
import { InviteDialog } from "@/components/participants/InviteDialog";
import { UploadParticipantsDialog } from "@/components/participants/UploadParticipantsDialog";
import { ScanParticipantsDialog } from "@/components/participants/ScanParticipantsDialog";
import { PaginationControls } from "@/components/PaginationControls";
import type { InviteRow } from "@/components/participants/InviteDialog";
import type { Participant, ParticipantDraft } from "@/components/participants/types";
import { ParticipantTableRow } from "./ParticipantTableRow";
import { ParticipantStatsPanel } from "./ParticipantStatsPanel";
import { PARTICIPANT_PAGE_SIZE } from "./types";

type Props = {
  selectedTypeId: string;
  selectedTypeName: string;
  selectedSubId: string;
  selectedGroupName: string;
  filteredParticipants: Participant[];
  selectedParticipant: Participant | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  page: number;
  setPage: (p: number) => void;
  participantTotal: number;
  totalAll: number;
  typesCount: number;
  onAdd: (draft: ParticipantDraft) => Promise<void>;
  onUpdate: (id: string, draft: ParticipantDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (drafts: ParticipantDraft[]) => Promise<void>;
  onGenerateInvites: (emails: string[]) => Promise<InviteRow[]>;
};

export function RosterTab({
  selectedTypeId,
  selectedTypeName,
  selectedSubId,
  selectedGroupName,
  filteredParticipants,
  selectedParticipant,
  selectedId,
  setSelectedId,
  loading,
  search,
  setSearch,
  page,
  setPage,
  participantTotal,
  totalAll,
  typesCount,
  onAdd,
  onUpdate,
  onDelete,
  onImport,
  onGenerateInvites,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {selectedTypeId === "__all__" ? (
          <span className="text-foreground font-semibold">{t("pt.allTypes")}</span>
        ) : (
          <>
            <span>{selectedTypeName}</span>
            <span className="px-1">›</span>
            <span className="text-foreground font-semibold">
              {selectedSubId === "__all__" ? t("pt.allGroups") : selectedGroupName}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pt.searchPlaceholder")}
            className="pl-9 h-11"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0">
          <UploadParticipantsDialog
            onSave={onImport}
            trigger={
              <Button variant="outline" size="sm" className="h-11 gap-1.5 hidden sm:flex">
                Upload CSV
              </Button>
            }
          />
          <ScanParticipantsDialog
            onSave={onImport}
            trigger={
              <Button variant="outline" size="sm" className="h-11 gap-1.5 hidden sm:flex">
                Scan
              </Button>
            }
          />
          <InviteDialog
            subtypeId={selectedSubId}
            subtypeName={selectedSubId === "__all__" ? selectedTypeName : selectedGroupName}
            onGenerate={onGenerateInvites}
            trigger={
              <Button variant="outline" size="sm" className="h-11 gap-1.5">
                Invite
              </Button>
            }
          />
          <ParticipantDialog
            title={t("pt.addTitle")}
            submitLabel={t("pt.addBtn")}
            onSubmit={onAdd}
            trigger={
              <Button
                size="sm"
                className="h-11 gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Plus size={14} /> Add
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("pt.totalParticipants")}
          </div>
          <div className="font-display text-2xl font-bold mt-1">{totalAll}</div>
        </div>
        <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("pt.showing")}
          </div>
          <div className="font-display text-2xl font-bold mt-1 text-primary">
            {participantTotal}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("pt.types")}
          </div>
          <div className="font-display text-2xl font-bold mt-1">{typesCount}</div>
        </div>
      </div>

      <div
        className={`flex gap-4 items-start ${selectedParticipant ? "lg:flex-row flex-col" : ""}`}
      >
        <div className={`min-w-0 ${selectedParticipant ? "lg:flex-1" : "w-full"}`}>
          {loading ? (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
              {t("pt.loading")}
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-6 text-center space-y-3">
              <UsersRound className="mx-auto size-10 text-primary/60" />
              {totalAll === 0 ? (
                <>
                  <p className="font-semibold">No participants yet</p>
                  <p className="text-sm text-muted-foreground">
                    Add one manually, upload a CSV, scan a roster, or generate invite links.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">{t("pt.noMatches")}</p>
                  <p className="text-sm text-muted-foreground">{t("pt.noMatchesHint")}</p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t("pt.colName")}</TableHead>
                    <TableHead className="whitespace-nowrap">{t("pt.colContact")}</TableHead>
                    <TableHead className="hidden md:table-cell whitespace-nowrap">{t("pt.colDetails")}</TableHead>
                    <TableHead className="hidden lg:table-cell whitespace-nowrap">{t("pt.colOrg")}</TableHead>
                    <TableHead className="w-[100px] text-right whitespace-nowrap">{t("pt.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((p) => (
                    <ParticipantTableRow
                      key={p.id}
                      p={p}
                      selected={selectedId === p.id}
                      onSelect={() => setSelectedId(selectedId === p.id ? null : p.id)}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                    />
                  ))}
                </TableBody>
                </Table>
              </div>
              <div className="px-4 py-3 border-t border-border">
                <PaginationControls
                  page={page}
                  pageSize={PARTICIPANT_PAGE_SIZE}
                  total={participantTotal}
                  label="participants"
                  onPageChange={setPage}
                />
              </div>
            </div>
          )}
        </div>
        {selectedParticipant && (
          <div className="lg:w-80 w-full shrink-0">
            <ParticipantStatsPanel
              participant={selectedParticipant}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
