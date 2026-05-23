import { describe, it, expect } from "vitest";
import { signupSchema, initialForm } from "@/routes/signup/-schema";

const validData = {
  firstName: "Ali",
  lastName: "Khan",
  email: "ali@example.com",
  password: "Secret123!",
  role: "teacher",
  useCases: ["practice"],
  referral: "google",
};

describe("signupSchema", () => {
  it("accepts valid data", () => {
    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects empty firstName", () => {
    const result = signupSchema.safeParse({ ...validData, firstName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("firstName");
    }
  });

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({ ...validData, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects email longer than 255 chars", () => {
    const result = signupSchema.safeParse({
      ...validData,
      email: "a".repeat(250) + "@b.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty role", () => {
    const result = signupSchema.safeParse({ ...validData, role: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty useCases array", () => {
    const result = signupSchema.safeParse({ ...validData, useCases: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing referral", () => {
    const result = signupSchema.safeParse({ ...validData, referral: "" });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from firstName", () => {
    const result = signupSchema.safeParse({ ...validData, firstName: "  Ali  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.firstName).toBe("Ali");
  });

  it("allows optional fields to be omitted", () => {
    const result = signupSchema.safeParse(validData); // no school, gradeYear, etc.
    expect(result.success).toBe(true);
  });

  it("rejects firstName longer than 60 chars", () => {
    const result = signupSchema.safeParse({ ...validData, firstName: "A".repeat(61) });
    expect(result.success).toBe(false);
  });
});

describe("initialForm", () => {
  it("has all required keys with empty defaults", () => {
    expect(initialForm.firstName).toBe("");
    expect(initialForm.lastName).toBe("");
    expect(initialForm.email).toBe("");
    expect(initialForm.password).toBe("");
    expect(initialForm.role).toBe("");
    expect(initialForm.useCases).toEqual([]);
    expect(initialForm.referral).toBe("");
  });
});
