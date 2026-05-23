import { describe, it, expect } from "vitest";
import {
  generateAccessCode,
  statusBadge,
  formatTimePerQuestion,
  emptyAttemptStats,
} from "@/components/sessions/types";
import type { Session } from "@/components/sessions/types";

// ─── generateAccessCode ──────────────────────────────────────────
describe("generateAccessCode()", () => {
  it("returns a 6-digit string", () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("returns a number between 100000 and 999999", () => {
    const num = Number(generateAccessCode());
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThanOrEqual(999999);
  });

  it("produces varied results (not broken randomness)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateAccessCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ─── statusBadge ────────────────────────────────────────────────
const baseSession: Session = {
  id: "s1",
  title: "Test Quiz",
  category_id: null,
  category_name: null,
  status: "draft",
  access_code: "123456",
  is_open: false,
  scheduled_at: null,
  default_time_per_question: 30,
  question_count: 5,
  participant_count: 0,
  created_at: new Date().toISOString(),
  attempts: { joined: 0, waiting: 0, submitted: 0, avgPercent: 0, topThree: [] },
};

describe("statusBadge()", () => {
  it("active → Live", () => {
    const b = statusBadge({ ...baseSession, status: "active" });
    expect(b.label).toBe("Live");
    expect(b.className).toContain("text-success");
  });

  it("grading → Needs Grading", () => {
    const b = statusBadge({ ...baseSession, status: "grading" });
    expect(b.label).toBe("Needs Grading");
  });

  it("completed → Completed", () => {
    const b = statusBadge({ ...baseSession, status: "completed" });
    expect(b.label).toBe("Completed");
  });

  it("expired → Expired with destructive class", () => {
    const b = statusBadge({ ...baseSession, status: "expired" });
    expect(b.label).toBe("Expired");
    expect(b.className).toContain("text-destructive");
  });

  it("scheduled with date → Scheduled", () => {
    const b = statusBadge({
      ...baseSession,
      status: "scheduled",
      scheduled_at: new Date().toISOString(),
    });
    expect(b.label).toBe("Scheduled");
  });

  it("draft without date → Pending", () => {
    const b = statusBadge({ ...baseSession, status: "draft" });
    expect(b.label).toBe("Pending");
  });
});

// ─── formatTimePerQuestion ───────────────────────────────────────
describe("formatTimePerQuestion()", () => {
  it("returns seconds for < 60s", () => {
    expect(formatTimePerQuestion(30)).toBe("30s / question");
    expect(formatTimePerQuestion(59)).toBe("59s / question");
  });

  it("returns singular 'min' for exactly 60s", () => {
    expect(formatTimePerQuestion(60)).toBe("1 min / question");
  });

  it("returns plural 'mins' for > 60s whole minutes", () => {
    expect(formatTimePerQuestion(120)).toBe("2 mins / question");
  });

  it("returns decimal minutes when not a whole number", () => {
    expect(formatTimePerQuestion(90)).toBe("1.5 mins / question");
  });
});

// ─── emptyAttemptStats ──────────────────────────────────────────
describe("emptyAttemptStats()", () => {
  it("returns all-zero stats with empty topThree", () => {
    const stats = emptyAttemptStats();
    expect(stats.joined).toBe(0);
    expect(stats.waiting).toBe(0);
    expect(stats.submitted).toBe(0);
    expect(stats.avgPercent).toBe(0);
    expect(stats.topThree).toEqual([]);
  });
});
