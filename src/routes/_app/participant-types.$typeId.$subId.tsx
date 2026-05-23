import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ScanLine, Search, Upload, UserPlus, Users, UsersRound } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ParticipantDialog } from "@/components/participants/ParticipantDialog";
import { InviteDialog } from "@/components/participants/InviteDialog";
import { UploadParticipantsDialog } from "@/components/participants/UploadParticipantsDialog";
import { ScanParticipantsDialog } from "@/components/participants/ScanParticipantsDialog";
import { PaginationControls } from "@/components/PaginationControls";
import { useSubTypeParticipants } from "./participant-types.$typeId.$subId/useSubTypeParticipants";
import { lazy, Suspense } from "react";
const ParticipantStatsPanel = lazy(() =>
  import("./participant-types.$typeId.$subId/ParticipantStatsPanel").then((m) => ({ default: m.ParticipantStatsPanel }))
);
import { ParticipantTableRow } from "./participant-types.$typeId.$subId/ParticipantTableRow";
import { PARTICIPANT_PAGE_SIZE } from "./participant-types.$typeId.$subId/types";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/participant-types/$typeId/$subId")({
  component: SubTypeParticipantsPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function SubTypeParticipantsPage() {
  const { typeId, subId } = Route.useParams();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const {
    type,
    sub,
    participants,
    loading,
    totalParticipants,
    create,
    createMany,
    update,
    remove,
    generateInvites,
  } = useSubTypeParticipants(user, typeId, subId, page, search);

  const selectedParticipant = selectedId
    ? (participants.find((p) => p.id === selectedId) ?? null)
    : null;

  const handleRemove = async (id: string) => {
    await remove(id);
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/participant-types" className="hover:text-foreground">
          All types
        </Link>
        <ChevronLeft className="size-3 rotate-180" />
        <Link to="/participant-types/$typeId" params={{ typeId }} className="hover:text-foreground">
          {type?.name ?? "Type"}
        </Link>
        <ChevronLeft className="size-3 rotate-180" />
        <span className="text-foreground">{sub?.name ?? "Group"}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <UsersRound className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {sub?.name ?? "Group"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Click any row to view that participant's quiz summary.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <UploadParticipantsDialog
            onSave={createMany}
            trigger={
              <Button variant="outline" className="gap-2">
                <Upload className="size-4" /> Upload File
              </Button>
            }
          />
          <ScanParticipantsDialog
            onSave={createMany}
            trigger={
              <Button variant="outline" className="gap-2">
                <ScanLine className="size-4" /> Scan Image
              </Button>
            }
          />
          <InviteDialog
            subtypeId={subId}
            subtypeName={sub?.name ?? "this group"}
            onGenerate={generateInvites}
            trigger={
              <Button variant="outline" className="gap-2">
                <Mail className="size-4" /> Invite Link
              </Button>
            }
          />
          <ParticipantDialog
            title="Add participant"
            description={`They'll be added under ${type?.name ?? "this type"} → ${sub?.name ?? "this group"}.`}
            submitLabel="Add"
            onSubmit={create}
            trigger={
              <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
                <UserPlus className="size-4" /> Add Manually
              </Button>
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name, email, roll number…"
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {totalParticipants} {totalParticipants === 1 ? "participant" : "participants"}
        </span>
      </div>

      <div
        className={`flex gap-4 items-start ${selectedParticipant ? "lg:flex-row flex-col" : ""}`}
      >
        <div className={`min-w-0 ${selectedParticipant ? "lg:flex-1" : "w-full"}`}>
          {loading ? (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
              Loading participants…
            </div>
          ) : participants.length === 0 && !search.trim() ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <Users className="mx-auto size-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No participants in this group yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add them manually or generate invite links.
              </p>
            </div>
          ) : participants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <Users className="mx-auto size-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No matches</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different search.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="hidden md:table-cell">Roll / Seat</TableHead>
                    <TableHead className="hidden lg:table-cell">Organization</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <ParticipantTableRow
                      key={p.id}
                      p={p}
                      selected={selectedId === p.id}
                      onSelect={() => setSelectedId((prev) => (prev === p.id ? null : p.id))}
                      onUpdate={update}
                      onDelete={handleRemove}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationControls
            page={page}
            pageSize={PARTICIPANT_PAGE_SIZE}
            total={totalParticipants}
            label="participants"
            onPageChange={setPage}
          />
        </div>

        {selectedParticipant && (
          <div className="lg:w-80 w-full shrink-0">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/30" />}>
              <ParticipantStatsPanel
                participant={selectedParticipant}
                onClose={() => setSelectedId(null)}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
