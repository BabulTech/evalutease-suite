import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Attendee } from "./types";
import { JoinPanel, StatTile } from "./JoinPanel";
import { AttendeeList } from "./AttendeeList";

export function LobbyView({
  attendees: _attendees,
  joinUrl,
  accessCode,
  onCopy,
  waiting,
  submitted,
  invited,
  joined,
  waitingTotal,
  submittedTotal,
  invitedTotal,
  query,
  onQueryChange,
  sort,
  onSortChange,
  waitingPage,
  submittedPage,
  invitedPage,
  onWaitingPageChange,
  onSubmittedPageChange,
  onInvitedPageChange,
  pageSize,
  onPageSizeChange,
}: {
  attendees: Attendee[];
  joinUrl: string;
  accessCode: string;
  onCopy: (text: string, label: string) => Promise<void>;
  waiting: Attendee[];
  submitted: Attendee[];
  invited: Attendee[];
  joined: number;
  waitingTotal: number;
  submittedTotal: number;
  invitedTotal: number;
  query: string;
  onQueryChange: (value: string) => void;
  sort: "started_at" | "name";
  onSortChange: (value: "started_at" | "name") => void;
  waitingPage: number;
  submittedPage: number;
  invitedPage: number;
  onWaitingPageChange: (page: number) => void;
  onSubmittedPageChange: (page: number) => void;
  onInvitedPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <JoinPanel
        joinUrl={joinUrl}
        accessCode={accessCode}
        onCopy={onCopy}
        size={188}
        showLink
        // react-doctor-disable-next-line react-doctor/jsx-no-jsx-as-prop
        statTiles={
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Joined" value={joined} tone="primary" />
            <StatTile label="Waiting" value={waitingTotal} tone="success" />
            <StatTile label="Submitted" value={submittedTotal} tone="success" />
          </div>
        }
      />
      <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              placeholder="Search participants..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(
              [
                ["started_at", "Newest"],
                ["name", "A–Z"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onSortChange(val)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                  sort === val
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Tabs defaultValue={invitedTotal > 0 ? "invited" : "waiting"} className="space-y-3">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="invited">Invited ({invitedTotal})</TabsTrigger>
            <TabsTrigger value="waiting">Waiting ({waitingTotal})</TabsTrigger>
            <TabsTrigger value="submitted">Submitted ({submittedTotal})</TabsTrigger>
          </TabsList>
          <TabsContent value="invited">
            <AttendeeList
              list={invited.slice(invitedPage * pageSize, invitedPage * pageSize + pageSize)}
              page={invitedPage}
              total={invitedTotal}
              onPageChange={onInvitedPageChange}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
              emptyHint="No invitees yet. Pre-assigned participants will appear here until they join."
            />
          </TabsContent>
          <TabsContent value="waiting">
            <AttendeeList
              list={waiting}
              page={waitingPage}
              total={waitingTotal}
              onPageChange={onWaitingPageChange}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
              emptyHint="Participants who scan the QR will show up here."
            />
          </TabsContent>
          <TabsContent value="submitted">
            <AttendeeList
              list={submitted}
              showScores
              page={submittedPage}
              total={submittedTotal}
              onPageChange={onSubmittedPageChange}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
              emptyHint="No one has submitted yet."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
