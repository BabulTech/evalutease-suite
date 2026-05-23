import { createFileRoute } from "@tanstack/react-router";
import { SessionActivityPanel } from "@/components/sessions/SessionActivityPanel";
import { useSessionLobby } from "./sessions.$sessionId/useSessionLobby";
import { SessionHeader } from "./sessions.$sessionId/SessionHeader";
import { ActionBar } from "./sessions.$sessionId/ActionBar";
import { GradingBanner } from "./sessions.$sessionId/GradingBanner";
import { AnnounceResultsToggle, SessionDialogs } from "./sessions.$sessionId/SessionDialogs";
import { LobbyView } from "./sessions.$sessionId/LobbyView";
import { LiveView } from "./sessions.$sessionId/LiveView";
import { ResultsView } from "./sessions.$sessionId/ResultsView";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/sessions/$sessionId")({
  component: SessionLobbyPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function SessionLobbyPage() {
  const { sessionId } = Route.useParams();
  const {
    session,
    isActive,
    isCompleted,
    paused,
    joined,
    badge,
    joinUrl,
    categoryName,
    subcategoryName,
    questionCount,
    attendees,
    attendeeTotal,
    invitedAttendees,
    waitingTotal,
    submittedTotal,
    invitedTotal,
    livePage,
    setLivePage,
    waitingPage,
    setWaitingPage,
    submittedPage,
    setSubmittedPage,
    invitedPage,
    setInvitedPage,
    attendeePageSize,
    setAttendeePageSize,
    participantQuery,
    setParticipantQuery,
    liveSort,
    setLiveSort,
    lobbySort,
    setLobbySort,
    busy,
    editOpen,
    setEditOpen,
    confirmDelete,
    setConfirmDelete,
    confirmClose,
    setConfirmClose,
    hasTypedQuestions,
    gradingSummary,
    showGradeConfirm,
    setShowGradeConfirm,
    bulkAiRunning,
    shortCreditCost,
    longCreditCost,
    totalGradingCost,
    credits,
    rosterEmails,
    waiting,
    submitted,
    reportAttempts,
    teacherName,
    schoolName,
    subject,
    start,
    pause,
    resume,
    forceEndQuiz,
    closeSession,
    remove,
    saveEdit,
    toggleShowResults,
    copy,
    emailParticipants,
    runBulkAiGrade,
  } = useSessionLobby(sessionId);

  if (!session) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        Loading session…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SessionHeader
        session={session}
        isActive={isActive}
        isCompleted={isCompleted}
        paused={paused}
        badge={badge}
        categoryName={categoryName}
        subcategoryName={subcategoryName}
        questionCount={questionCount}
        joined={joined}
        submittedTotal={submittedTotal}
      />

      <ActionBar
        session={session}
        sessionId={sessionId}
        isActive={isActive}
        isCompleted={isCompleted}
        paused={paused}
        busy={busy}
        hasTypedQuestions={hasTypedQuestions}
        rosterEmails={rosterEmails}
        categoryName={categoryName}
        subcategoryName={subcategoryName}
        questionCount={questionCount}
        reportAttempts={reportAttempts}
        teacherName={teacherName}
        schoolName={schoolName}
        subject={subject}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onForceEnd={forceEndQuiz}
        onConfirmClose={() => setConfirmClose(true)}
        onConfirmDelete={() => setConfirmDelete(true)}
        onEditOpen={() => setEditOpen(true)}
        onEmailParticipants={emailParticipants}
      />

      <div className="print:hidden">
        <SessionActivityPanel sessionId={session.id} />
      </div>

      {isCompleted && gradingSummary && gradingSummary.short + gradingSummary.long > 0 && (
        <GradingBanner
          sessionId={sessionId}
          gradingSummary={gradingSummary}
          shortCreditCost={shortCreditCost}
          longCreditCost={longCreditCost}
          totalGradingCost={totalGradingCost}
          creditBalance={credits.balance}
          bulkAiRunning={bulkAiRunning}
          showGradeConfirm={showGradeConfirm}
          onShowConfirm={() => setShowGradeConfirm(true)}
          onHideConfirm={() => setShowGradeConfirm(false)}
          onBulkAiGrade={runBulkAiGrade}
        />
      )}

      {!isCompleted && (
        <AnnounceResultsToggle
          checked={session.show_results_after_quiz}
          onChange={(v) => void toggleShowResults(v)}
        />
      )}

      {isCompleted ? (
        <ResultsView
          attendees={attendees}
          title={session.title}
          categoryLabel={[categoryName, subcategoryName].filter(Boolean).join(" → ") || ""}
          questionCount={questionCount}
          createdAt={session.created_at}
          reportAttempts={reportAttempts}
          teacherName={teacherName}
          schoolName={schoolName}
          subjectLabel={subject}
          topicLabel={session.topic ?? ""}
          hasTypedQuestions={hasTypedQuestions}
          pendingGradingCount={gradingSummary ? gradingSummary.short + gradingSummary.long : 0}
        />
      ) : isActive ? (
        <LiveView
          attendees={attendees}
          joinUrl={joinUrl}
          accessCode={session.access_code ?? ""}
          onCopy={copy}
          paused={paused}
          joinedTotal={attendeeTotal}
          submittedTotal={submittedTotal}
          query={participantQuery}
          onQueryChange={setParticipantQuery}
          sort={liveSort}
          onSortChange={setLiveSort}
          page={livePage}
          total={attendeeTotal}
          onPageChange={setLivePage}
          pageSize={attendeePageSize}
          onPageSizeChange={setAttendeePageSize}
          hasTypedQuestions={hasTypedQuestions}
        />
      ) : (
        <LobbyView
          attendees={attendees}
          joinUrl={joinUrl}
          accessCode={session.access_code ?? ""}
          onCopy={copy}
          waiting={waiting}
          submitted={submitted}
          invited={invitedAttendees}
          joined={joined}
          waitingTotal={waitingTotal}
          submittedTotal={submittedTotal}
          invitedTotal={invitedTotal}
          query={participantQuery}
          onQueryChange={setParticipantQuery}
          sort={lobbySort}
          onSortChange={setLobbySort}
          waitingPage={waitingPage}
          submittedPage={submittedPage}
          invitedPage={invitedPage}
          onWaitingPageChange={setWaitingPage}
          onSubmittedPageChange={setSubmittedPage}
          onInvitedPageChange={setInvitedPage}
          pageSize={attendeePageSize}
          onPageSizeChange={setAttendeePageSize}
        />
      )}

      <SessionDialogs
        sessionTitle={session.title}
        editOpen={editOpen}
        onEditOpenChange={setEditOpen}
        initialTitle={session.title}
        initialTime={session.default_time_per_question ?? 60}
        onSaveEdit={saveEdit}
        confirmDelete={confirmDelete}
        onConfirmDeleteChange={setConfirmDelete}
        confirmClose={confirmClose}
        onConfirmCloseChange={setConfirmClose}
        busy={busy}
        onDelete={() => void remove()}
        onClose={() => void closeSession()}
      />
    </div>
  );
}
