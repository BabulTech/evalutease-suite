import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Check, FolderPlus, Layers, Lock, Plus, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useParticipantsIndex } from "./participant-types/useParticipantsIndex";
import { QuickCreateDialog } from "./participant-types/QuickCreateDialog";
import { ChipSelector } from "./participant-types/ChipSelector";
import { RosterTab } from "./participant-types/RosterTab";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/participant-types")({ component: ParticipantsPage });

// react-doctor-disable-next-line react-doctor/only-export-components
function ParticipantsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/participant-types" || pathname === "/participant-types/";
  if (!onIndex) return <Outlet />;
  return <ParticipantsIndex />;
}

// react-doctor-disable-next-line react-doctor/only-export-components
function ParticipantsIndex() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const {
    types,
    visibleSubs,
    filteredParticipants,
    selectedParticipant,
    loading,
    selectedTypeId,
    selectedSubId,
    search,
    setSearch,
    selectedId,
    setSelectedId,
    page,
    setPage,
    participantTotal,
    typeCounts,
    subCounts,
    createTypeOpen,
    setCreateTypeOpen,
    createSubOpen,
    setCreateSubOpen,
    activeTab,
    setActiveTab,
    overlay,
    canAddSub,
    canAddToGroup,
    totalAll,
    selectedTypeName,
    selectedGroupName,
    handlePickType,
    handlePickSub,
    createType,
    createSub,
    createParticipant,
    createMany,
    updateParticipant,
    removeParticipant,
    generateInvites,
  } = useParticipantsIndex(user);

  const tabDefs = [
    {
      n: 1 as const,
      label: t("pt.type"),
      value: selectedTypeId === "__all__" ? t("pt.allTypes") : selectedTypeName,
      icon: Users,
      locked: false,
      done: selectedTypeId !== "__all__" || activeTab > 1,
    },
    {
      n: 2 as const,
      label: t("pt.group"),
      value:
        selectedSubId === "__all__"
          ? selectedTypeId === "__all__"
            ? "-"
            : t("pt.allGroups")
          : selectedGroupName,
      icon: Layers,
      locked: selectedTypeId === "__all__",
      done: selectedSubId !== "__all__",
    },
    {
      n: 3 as const,
      label: "People",
      value: participantTotal > 0 ? `${participantTotal}` : "",
      icon: UserPlus,
      locked: false,
      done: participantTotal > 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2 min-w-0">
          <Users className="size-5 sm:size-6 text-primary shrink-0" />
          <span className="truncate">{t("pt.manageTitle")}</span>
        </h1>
        {canAddToGroup && (
          <Button
            onClick={() => navigate({ to: "/participant-types/add" })}
            className="h-11 gap-2 bg-gradient-primary text-primary-foreground shadow-glow w-full sm:w-auto shrink-0"
          >
            <UserPlus className="size-4 shrink-0" />
            <span className="truncate">Add to {selectedGroupName}</span>
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="rounded-2xl border border-border bg-card/50 p-1.5 flex flex-col sm:flex-row gap-1.5 w-full max-w-full overflow-hidden">
        {tabDefs.map((tab) => {
          const isActive = activeTab === tab.n;
          return (
            <button
              key={tab.n}
              type="button"
              onClick={() => {
                if (!tab.locked) setActiveTab(tab.n);
              }}
              disabled={tab.locked}
              title={tab.value || tab.label}
              className={`w-full sm:flex-1 sm:min-w-0 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all min-h-[56px] ${
                isActive
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : tab.locked
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-muted/40 cursor-pointer"
              }`}
            >
              <span
                className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? "bg-primary-foreground/20"
                    : tab.done
                      ? "bg-success/20 text-success"
                      : "bg-muted/60 text-muted-foreground"
                }`}
              >
                {tab.locked ? (
                  <Lock className="size-3" />
                ) : tab.done && !isActive ? (
                  <Check className="size-3.5" />
                ) : (
                  tab.n
                )}
              </span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div
                  className={`text-sm font-semibold leading-tight ${isActive ? "" : "text-foreground"}`}
                >
                  {tab.label}
                </div>
                <div
                  className={`text-[11px] truncate leading-tight mt-0.5 max-w-full ${isActive ? "opacity-80" : "text-muted-foreground"}`}
                >
                  {tab.value || (tab.locked ? "Locked" : "Tap to choose")}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Type */}
      {activeTab === 1 && (
        <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5 space-y-4 min-w-0 overflow-hidden">
          <div className="flex items-start sm:items-center justify-between gap-2 min-w-0">
            <div className="text-sm font-semibold text-foreground min-w-0 flex-1">
              {types.length === 0 ? "Start by creating a type" : "Choose a participant type"}
            </div>
            <button
              type="button"
              onClick={() => setCreateTypeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all shrink-0 whitespace-nowrap"
            >
              <FolderPlus size={13} /> New Type
            </button>
          </div>
          {types.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Users className="mx-auto size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Types are roles you'll quiz (e.g. Students, Employees)
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setCreateTypeOpen(true)}
              >
                <Plus size={14} /> Create first type
              </Button>
            </div>
          ) : (
            <ChipSelector
              items={types.map((ty) => ({
                id: ty.id,
                label: ty.name,
                count: typeCounts.get(ty.id) ?? 0,
              }))}
              selected={selectedTypeId}
              onSelect={handlePickType}
              allLabel={t("pt.allTypes")}
            />
          )}
        </div>
      )}

      {/* Tab 2: Group */}
      {activeTab === 2 && selectedTypeId !== "__all__" && (
        <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5 space-y-4 min-w-0 overflow-hidden">
          <div className="flex items-start sm:items-center justify-between gap-2 min-w-0">
            <div className="text-sm min-w-0 flex-1 break-anywhere">
              <span className="text-muted-foreground">{selectedTypeName} · </span>
              <span className="font-semibold">Choose a group</span>
            </div>
            <button
              type="button"
              onClick={() => setCreateSubOpen(true)}
              disabled={!canAddSub}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all disabled:opacity-40 shrink-0 whitespace-nowrap"
            >
              <Plus size={13} /> New Group
            </button>
          </div>
          {visibleSubs.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                No groups in <span className="font-medium text-foreground">{selectedTypeName}</span>{" "}
                yet
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setCreateSubOpen(true)}
              >
                <Plus size={14} /> Add first group
              </Button>
            </div>
          ) : (
            <ChipSelector
              items={visibleSubs.map((s) => ({
                id: s.id,
                label: s.name,
                count: subCounts.get(s.id) ?? 0,
              }))}
              selected={selectedSubId}
              onSelect={handlePickSub}
              allLabel={t("pt.allGroups")}
            />
          )}
        </div>
      )}

      {/* Tab 3: Roster */}
      {activeTab === 3 && (
        <RosterTab
          selectedTypeId={selectedTypeId}
          selectedTypeName={selectedTypeName}
          selectedSubId={selectedSubId}
          selectedGroupName={selectedGroupName}
          filteredParticipants={filteredParticipants}
          selectedParticipant={selectedParticipant}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          loading={loading}
          search={search}
          setSearch={setSearch}
          page={page}
          setPage={setPage}
          participantTotal={participantTotal}
          totalAll={totalAll}
          typesCount={types.length}
          onAdd={createParticipant}
          onUpdate={updateParticipant}
          onDelete={removeParticipant}
          onImport={createMany}
          onGenerateInvites={generateInvites}
        />
      )}

      <QuickCreateDialog
        open={createTypeOpen}
        onClose={() => setCreateTypeOpen(false)}
        title={t("pt.newType")}
        placeholder={t("pt.newTypePlaceholder")}
        onConfirm={createType}
      />
      <QuickCreateDialog
        open={createSubOpen}
        onClose={() => setCreateSubOpen(false)}
        title={t("pt.newGroup")}
        placeholder={t("pt.newGroupPlaceholder")}
        onConfirm={createSub}
      />

      <LoadingOverlay
        visible={overlay.visible}
        variant="driven"
        title={overlay.title}
        steps={overlay.steps}
        currentStep={overlay.step}
        hint={overlay.hint}
      />
    </div>
  );
}
