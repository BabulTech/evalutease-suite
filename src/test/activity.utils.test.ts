import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelative, linkFor } from "@/components/dashboard/activity/utils";
import type { RecentActivityRow } from "@/components/dashboard/activity/types";

// ─── formatRelative ──────────────────────────────────────────────
describe("formatRelative()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for < 60 seconds ago", () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(formatRelative(iso)).toBe("just now");
  });

  it("returns minutes for 1–59 minutes ago", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelative(iso)).toBe("5 min ago");
  });

  it("returns hours for 1–23 hours ago", () => {
    const iso = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(formatRelative(iso)).toBe("3 h ago");
  });

  it("returns days for 1–6 days ago", () => {
    const iso = new Date(Date.now() - 2 * 86400_000).toISOString();
    expect(formatRelative(iso)).toBe("2 d ago");
  });

  it("returns locale date string for >= 7 days ago", () => {
    const iso = new Date(Date.now() - 10 * 86400_000).toISOString();
    const result = formatRelative(iso);
    expect(result).not.toContain("ago");
    expect(result).not.toBe("just now");
  });
});

// ─── linkFor ────────────────────────────────────────────────────
const base: RecentActivityRow = {
  id: "r1",
  module: "sessions",
  action_type: "created",
  entity_type: "quiz_session",
  entity_id: "sess-abc",
  entity_label: null,
  message: "Session created",
  details: null,
  risk_score: 0,
  actor_name: "Alice",
  created_at: new Date().toISOString(),
};

describe("linkFor()", () => {
  it("returns session link for quiz_session entity", () => {
    expect(linkFor(base)).toBe("/sessions/sess-abc");
  });

  it("returns session link for quiz_attempt using details.session_id", () => {
    const row: RecentActivityRow = {
      ...base,
      entity_type: "quiz_attempt",
      entity_id: "att-1",
      details: { session_id: "sess-xyz" },
    };
    expect(linkFor(row)).toBe("/sessions/sess-xyz");
  });

  it("returns null for quiz_attempt without details.session_id", () => {
    const row: RecentActivityRow = {
      ...base,
      entity_type: "quiz_attempt",
      entity_id: "att-1",
      details: null,
    };
    expect(linkFor(row)).toBeNull();
  });

  it("returns /billing for billing module", () => {
    expect(linkFor({ ...base, module: "billing" })).toBe("/billing");
  });

  it("returns /settings for feedback module", () => {
    expect(linkFor({ ...base, module: "feedback" })).toBe("/settings");
  });

  it("returns null for unknown module", () => {
    expect(linkFor({ ...base, module: "unknown" })).toBeNull();
  });
});
