# EvaluTease Suite — User Acceptance Testing (UAT) Document

**Document Version:** 2.0  
**Date:** 2026-05-25  
**Platform:** EvaluTease Suite — Babul.Quiz (Web — React + Supabase)  
**Prepared By:** QA / Development Team  
**Status:** Ready for Testing

---

## TABLE OF CONTENTS

1. [Document Purpose & Scope](#1-document-purpose--scope)
2. [Test Environment Setup](#2-test-environment-setup)
3. [User Roles & Permissions Matrix](#3-user-roles--permissions-matrix)
4. [Plan Tiers Reference](#4-plan-tiers-reference)
5. [Credit Cost & Pricing Reference](#5-credit-cost--pricing-reference)
6. [Module 1 — Authentication & Signup](#6-module-1--authentication--signup)
7. [Module 2 — Question Bank (Categories & Questions)](#7-module-2--question-bank-categories--questions)
8. [Module 3 — Participant Management](#8-module-3--participant-management)
9. [Module 4 — Session Creation & Configuration](#9-module-4--session-creation--configuration)
10. [Module 5 — Live Quiz (Host Side)](#10-module-5--live-quiz-host-side)
11. [Module 6 — Live Quiz (Participant Side / Public)](#11-module-6--live-quiz-participant-side--public)
12. [Module 7 — Grading (Manual & AI)](#12-module-7--grading-manual--ai)
13. [Module 8 — Reports & Analytics](#13-module-8--reports--analytics)
14. [Module 9 — Billing, Plans & Credits](#14-module-9--billing-plans--credits)
15. [Module 10 — Organisation / Enterprise](#15-module-10--organisation--enterprise)
16. [Module 11 — Settings & Profile](#16-module-11--settings--profile)
17. [Module 12 — Notifications](#17-module-12--notifications)
18. [Module 13 — Admin Panel](#18-module-13--admin-panel)
19. [Module 14 — Security & Permission Checks](#19-module-14--security--permission-checks)
20. [Cross-Cutting Real-Time Tests](#20-cross-cutting-real-time-tests)
21. [UAT Sign-Off Sheet](#21-uat-sign-off-sheet)
22. [Bug Report Template](#22-bug-report-template)
23. [User Guidance — Step-by-Step Feature Guide](#23-user-guidance--step-by-step-feature-guide)

---

## 1. Document Purpose & Scope

### 1.1 Purpose

This User Acceptance Testing (UAT) document defines every testable function, flow, and feature of the EvaluTease Suite (Babul.Quiz) platform. It serves two purposes:

1. **Testers / QA Engineers** — A structured test plan with pass/fail criteria, preconditions, steps, and expected results for every module.
2. **End Users** — A plain-language guide explaining every feature and how to use it correctly (see Section 23).

### 1.2 Scope

All features accessible from the web application are in scope:

| Area | In Scope |
|------|----------|
| Authentication (signup, login, password reset) | ✅ |
| Question bank (create, AI generation, OCR scan, manual) | ✅ |
| Participant management (manual entry, invite links) | ✅ |
| Session creation & scheduling | ✅ |
| Live quiz hosting & real-time control | ✅ |
| Participant quiz experience (public link / QR) | ✅ |
| Grading — manual and AI | ✅ |
| Reports & analytics (export) | ✅ |
| Billing, plan upgrade, credits | ✅ |
| Organisation / enterprise features | ✅ |
| Settings, profile, custom branding | ✅ |
| Notifications | ✅ |
| Admin dashboard | ✅ |
| Security & RLS (data isolation) | ✅ |
| Real-time features (lobby, leaderboard) | ✅ |

### 1.3 Out of Scope (MVP Exclusions)

- Mobile native apps (not yet released)
- CSV bulk participant import (not in MVP — invite links and manual entry only)
- CSV bulk question upload (not in MVP — use manual, AI, or OCR)
- Third-party payment gateway internal processing
- Supabase infrastructure / database internals
- Google OAuth / social login (email/password only in MVP)

---

## 2. Test Environment Setup

### 2.1 Required Test Accounts

Create the following accounts before testing. **Any email domain is allowed** — there is no domain restriction for any plan.

| Account Label | Role | Plan | Notes |
|---------------|------|------|-------|
| `ADMIN_USER` | admin | N/A | Site-level admin — must have `admin` role in `user_roles` |
| `FREE_USER` | teacher | individual_starter | Signed up as Personal account |
| `PRO_USER` | teacher | individual_pro | Upgraded by admin via admin panel |
| `ENT_ADMIN` | teacher | enterprise_starter | Signed up as Enterprise account (15-day trial) |
| `ENT_HOST` | teacher | (member of ENT_ADMIN org) | Invited host inside ENT_ADMIN's org |
| `PARTICIPANT_1` | none needed | N/A | Joins quizzes anonymously via code |
| `PARTICIPANT_2` | none needed | N/A | Second participant for competition / real-time tests |

### 2.2 Test Data Prerequisites

Before running tests, ensure the following exists:

- At least **1 category** and **1 topic** owned by `PRO_USER`
- At least **10 MCQ questions** in that topic
- At least **5 short-answer questions** (for grading tests)
- At least **1 participant type** with **1 group** and **3 participants** (added manually)
- At least **1 completed session** (for reports tests)

### 2.3 Test Conventions

| Symbol | Meaning |
|--------|---------|
| ✅ PASS | Result matches expected output |
| ❌ FAIL | Result does not match — log bug |
| ⚠️ PARTIAL | Feature works but with minor issues — log observation |
| [TC-XXX-NN] | Test Case ID (Module-Number) |

---

## 3. User Roles & Permissions Matrix

### 3.1 Role Definitions

| Role | Where Stored | Who Gets It | What They Can Do |
|------|-------------|-------------|-----------------|
| `admin` | `user_roles.role` | Manually assigned in DB | Full platform control — admin dashboard, manage all users, plans, credits |
| `teacher` | `user_roles.role` | Every new signup | Create/manage quizzes, questions, participants — owns their data |
| `host` (org) | `company_members.role` | Invited by org admin | Like teacher but draws from org credit pool |
| `coordinator` (org) | `company_members.role` | Invited by org admin | Team coordination, limited credit access |
| anonymous participant | N/A | Joins via code/QR | Can only answer the specific assigned quiz session |

### 3.2 Data Access Matrix

| Resource | admin | teacher (owner) | teacher (other) | host (own org) | participant |
|----------|-------|-----------------|-----------------|----------------|-------------|
| Own profile | R/W | R/W | — | R/W | — |
| Other profiles | R | — | — | — | — |
| Own questions | R/W | R/W | — | R/W | — |
| Other's questions | R | — | — | — | — |
| Own sessions | R/W | R/W | — | R/W | — |
| Public session (join) | — | — | — | — | R |
| Plans | R | R | R | R | — |
| Own subscription | R/W | R | — | R | — |
| All subscriptions | R/W | — | — | — | — |
| Company profile | R/W | — | — | R (own org) | — |
| Company members | R/W | — | — | R (own org) | — |
| Admin dashboard | R/W | — | — | — | — |

---

## 4. Plan Tiers Reference

| Feature | Individual Free | Individual Pro | Enterprise Trial (15d) | Enterprise Free | Enterprise Pro |
|---------|----------------|----------------|----------------------|-----------------|----------------|
| **Price/month** | Free | PKR 999 | Free | Free | PKR 7,999 |
| Quizzes / day | 3 | 50 | 3 | 3 | Unlimited |
| Scheduled / day | 1 | 10 | 1 | 1 | Unlimited |
| Participants / session | 50 | 200 | 50 | 50 | Unlimited |
| Total participants | 50 | Unlimited | 50 | 50 | Unlimited |
| Question bank | 100 | 2,000 | 100 | 100 | Unlimited |
| Max hosts | 1 | 1 | 2 | **3** | Unlimited |
| AI features | ❌ | ✅ credit-based | ✅ 10 free calls | ❌ | ✅ credit-based |
| Custom branding | ❌ | ❌ | ❌ | ❌ | ✅ |
| White-label | ❌ | ❌ | ❌ | ❌ | ✅ |
| AI interviews | ❌ | ❌ | ❌ | ❌ | ✅ |
| AI coding tests | ❌ | ❌ | ❌ | ❌ | ✅ |
| Email templates | ❌ | ❌ | ❌ | ❌ | ✅ |
| Buy credits | ❌ | ✅ | ❌ | ❌ | ✅ |
| Credits / month | 0 | 200 | 0 | 0 | 3,000 |
| Export watermark | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Trial expiry** | — | — | → Enterprise Free | — | — |

> **Important:** When an Enterprise Trial (15 days) expires, the account automatically downgrades to **Enterprise Free** — NOT Individual Free. This preserves access for up to 3 hosts while removing AI and advanced features.

> **No email domain restriction** — Both Personal and Enterprise accounts can be created with any email address (Gmail, Yahoo, company email, etc.).

---

## 5. Credit Cost & Pricing Reference

### 5.1 Credit Cost Per Operation

| Operation | Credits Used | Notes |
|-----------|-------------|-------|
| Generate 10 MCQ questions (AI) | 10 | Highest quality, highest cost |
| Generate 10 True/False questions (AI) | 3 | Cheapest type |
| Generate 10 Short Answer questions (AI) | 5 | Medium cost |
| Generate 10 Long Answer questions (AI) | 10 | Same as MCQ |
| Generate 10 **Mixed** questions (AI) | **6** | See note below |
| OCR image scan | 2 | Per image |
| AI grade — short answer (per 10) | 1 | |
| AI grade — long answer (per 10) | 3 | |
| Extra quiz (over daily limit) | 1 | |
| Extra participant (over session limit) | 1 | |

> **Mixed Questions (6 credits/10):** Mixed mode generates a combination of MCQ, True/False, and Short Answer questions in a single batch. The 6-credit rate is a weighted average between T/F (3) and MCQ (10). It does **not** include Long Answer questions — those must be generated separately. Mixed is the best value if you want variety in one generation call.

### 5.2 Credit Package Prices (Recommended — 200% Markup over AI Cost)

| Package | Credits | Price (PKR) | Per Credit | Margin | Badge |
|---------|---------|-------------|-----------|--------|-------|
| Starter Pack | 50 | **PKR 199** | PKR 3.98 | 82% | — |
| Value Pack | 100 | **PKR 399** | PKR 3.99 | 82% | Popular |
| Power Pack | 150 | **PKR 499** | PKR 3.33 | 79% | Best Value |

> **Pricing rationale:** Base AI API cost ≈ PKR 0.72/credit. All packs priced under PKR 500 with ~80%+ gross margin. Starter and Value maintain 82% margin; Power offers slight bulk value at 79% margin.

---

## 6. Module 1 — Authentication & Signup

### 6.1 Feature Overview

Users register and log in using email and password. Signup is a 2-step form. There is no Google OAuth or social login in this version.

**Signup fields (Step 2 — Your Profile):**
- First name + Last name
- I am a... (Student / Teacher / Employer / Other)
- Mobile number (optional)
- Email
- Password (min 8 chars, must contain uppercase, lowercase, number, special character)
- I want to use this application for (Education / Sports / Fun / Religion / Science / Academic) — multi-select
- How did you hear about us? (Ads / Friend Recommendation / Employee Referral / Web Search) — single select
- Account type: **Personal** or **Enterprise** (shown at bottom with a "Change" button)

---

### TC-AUTH-01: New User Signup — Personal (Individual Free) Account

**Precondition:** No existing account with the test email.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/signup` | Signup page loads with Sign In / Sign Up tab toggle. Step indicator shows step 1 |
| 2 | Click "Sign Up" tab | Signup form shown (Step 1 may be plan selection or go directly to profile form) |
| 3 | On profile step — enter First name: "Ali", Last name: "Khan" | Fields accept input |
| 4 | Select "I am a...": Teacher | Chip highlights |
| 5 | Mobile: "+92 300 0000000" (optional — can be skipped) | Field accepts |
| 6 | Enter email: "ali@gmail.com" | Accepted (no domain restriction) |
| 7 | Enter password: "Test@1234" | Password strength bar shows "Strong" or "Good" |
| 8 | Select use case: "Education" | Chip highlights |
| 9 | Select referral: "Web Search" | Chip highlights |
| 10 | Account type shows "Personal" at bottom | "Personal" label visible. "Change" button visible |
| 11 | Click "Create Account" | Loading overlay: "Creating your account…" → "Setting up your workspace…" etc. |
| 12 | Redirects to `/dashboard` | Dashboard loads. Plan badge = "Individual Free". User name = "Ali Khan" |
| 13 | Database check | `profiles` row created. `user_roles.role = 'teacher'`. `user_subscriptions.plan_id` = individual_starter |

**Expected:** ✅ Account created with correct plan. Dashboard loads.

---

### TC-AUTH-02: New User Signup — Enterprise Account

**Precondition:** No existing account. Can use ANY email (Gmail, Yahoo, company — no restriction).

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Complete profile form fields (same as TC-AUTH-01) | — |
| 2 | Notice "Account type: Personal" at bottom | — |
| 3 | Click "Change" | Account type toggles to "Enterprise" |
| 4 | Account type label now shows "Enterprise" in yellow | — |
| 5 | Click "Create Account" | Account created |
| 6 | Dashboard shows "Enterprise Trial" badge | Trial countdown banner: "15 days remaining" |
| 7 | Database check | `user_subscriptions.expires_at` = now + 15 days. `trial_ai_usage` row with `used_calls = 0` |

**Expected:** ✅ Enterprise trial created with any email address. 15-day countdown visible.

---

### TC-AUTH-03: Signup with Gmail for Enterprise (Must Be Allowed)

**This tests that there is NO domain blocking for Enterprise signups.**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Set account type to "Enterprise" | — |
| 2 | Enter "test@gmail.com" as email | Field accepts it |
| 3 | Complete form and click "Create Account" | Account created successfully |
| 4 | Enterprise trial starts | No error about domain. Trial badge shown |

**Expected:** ✅ Gmail allowed for Enterprise. No blocked domain error.

---

### TC-AUTH-04: Login — Valid Credentials

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/login` | Login page loads. "Sign In" tab active |
| 2 | Enter valid email & password | Fields accept input |
| 3 | Click "Sign In" | Redirects to `/dashboard` |
| 4 | TopBar shows user name | "Welcome back, Ali Khan" or avatar with name |

**Expected:** ✅ Login succeeds.

---

### TC-AUTH-05: Login — Invalid Credentials

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter valid email, wrong password | — |
| 2 | Click "Sign In" | Error: "Invalid email or password." No redirect |
| 3 | Enter non-existent email | Same error. No redirect |

**Expected:** ✅ Correct error message shown.

---

### TC-AUTH-06: Password Reset Flow

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Forgot Password" on login page | Navigates to `/forgot-password` |
| 2 | Enter registered email | Accepted |
| 3 | Click "Send Reset Link" | Message: "Check your email for a reset link." |
| 4 | Open email | Reset link received |
| 5 | Click link | Navigates to `/reset-password` |
| 6 | Enter new password meeting all rules | Strength bar shows Good/Strong |
| 7 | Submit | Success. Redirects to `/login` |
| 8 | Login with new password | Succeeds |

**Expected:** ✅ Full password reset cycle works.

---

### TC-AUTH-07: Password Rules Validation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter password "password" (no uppercase/number/special) | Strength bar shows "Weak" or "Very weak". Rules checklist shows red |
| 2 | Enter "Password1" (no special char) | Checklist missing special character rule |
| 3 | Enter "Password1!" (all rules met) | All checklist items green. Strength = "Strong" |
| 4 | Try to submit with weak password | Validation error: "Must contain a special character" etc. |

**Expected:** ✅ Password strength enforced. Cannot submit without meeting all rules.

---

### TC-AUTH-08: Sign Out

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click user avatar in TopBar | Dropdown opens |
| 2 | Click "Sign Out" | Session cleared. Redirects to `/login` |
| 3 | Navigate to `/dashboard` directly | Redirects to `/login` |

**Expected:** ✅ Session cleared. Protected routes inaccessible.

---

### TC-AUTH-09: Unauthenticated Access to Protected Routes

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Without login, navigate to `/dashboard` | Redirect to `/login` |
| 2 | Navigate to `/sessions` | Redirect to `/login` |
| 3 | Navigate to `/billing` | Redirect to `/login` |
| 4 | Navigate to `/admin` | Redirect to `/login` |

**Expected:** ✅ All protected routes redirect when unauthenticated.

---

### TC-AUTH-10: Duplicate Email Signup

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Try to sign up with an email that already has an account | Email field shows inline error: "This email is already in use." (real-time check) |
| 2 | Cannot proceed to account creation | "Create Account" button blocked |

**Expected:** ✅ Duplicate email detected early (real-time email availability check).

---

## 7. Module 2 — Question Bank (Categories & Questions)

### 7.1 Feature Overview

Questions are organised in two levels:
- **Category** — The subject (e.g., "Mathematics", "History")
- **Topic** — The sub-subject inside a category (e.g., "Algebra" inside "Mathematics")

Questions can be added by: Manual entry, AI generation, or OCR image scan. CSV bulk import is **not available in this MVP**.

---

### TC-CAT-01: Create a Category

**User:** PRO_USER

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/categories` (Questions in sidebar) | Page loads |
| 2 | Click "+" or "New Category" | Dialog opens |
| 3 | Enter name: "Mathematics", subject: "Math" | Accepted |
| 4 | Click "Create" | Category card appears in grid |
| 5 | Database | `question_categories` row with `owner_id = PRO_USER.id` |

**Expected:** ✅ Category created.

---

### TC-CAT-02: Create a Topic Inside a Category

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click on "Mathematics" category | Category detail page |
| 2 | Click "New Topic" | Create topic dialog |
| 3 | Enter name: "Algebra" | Accepted |
| 4 | Create | Topic card appears |
| 5 | Database | `question_subcategories` row linked to category |

**Expected:** ✅ Topic created under category.

---

### TC-CAT-03: Add MCQ Question Manually

**User:** PRO_USER. Precondition: "Mathematics > Algebra" exists.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Add Questions" → "Manual Entry" | Form loads |
| 2 | Select category: Mathematics, topic: Algebra | Dropdowns work |
| 3 | Select type: "Multiple Choice (MCQ)" | 4-option form appears |
| 4 | Question: "What is 2+2?" | Accepted |
| 5 | Options: A=3, B=4, C=5, D=6. Mark B correct | Correct answer selected |
| 6 | Difficulty: Easy | Selected |
| 7 | Click "Save Question" | Saved. Toast: "Question saved." |
| 8 | View in topic | Question appears in list |

**Expected:** ✅ MCQ question created.

---

### TC-CAT-04: Add True/False Question

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Manual entry, select type: "True/False" | Two buttons: True / False |
| 2 | Question: "The sky is blue." Mark True as correct | — |
| 3 | Save | Saved as `true_false` type |

**Expected:** ✅ True/False question created.

---

### TC-CAT-05: Add Short Answer Question

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select type: "Short Answer" | Text answer field appears (no options) |
| 2 | Question: "Name the capital of France." | — |
| 3 | Correct answer: "Paris" | — |
| 4 | Save | Saved as `short_answer` type |

**Expected:** ✅ Short answer saved.

---

### TC-CAT-06: Add Long Answer Question

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select type: "Long Answer" | Multi-line text field |
| 2 | Question: "Explain the causes of World War 1." | — |
| 3 | No auto-correct answer (needs manual/AI grading) | — |
| 4 | Save | Saved as `long_answer` type |

**Expected:** ✅ Long answer saved. No correct answer required.

---

### TC-CAT-07: AI Question Generation — MCQ (Pro Plan)

**User:** PRO_USER. Precondition: AI enabled, credits > 0.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | "Add Questions" → "AI Generation" | AI prompt form loads |
| 2 | Prompt: "10 MCQ questions about the French Revolution, medium difficulty" | Field accepts text |
| 3 | Type: MCQ, quantity: 10 | Selected |
| 4 | Click "Generate" | Loading spinner. 5-20 seconds |
| 5 | 10 questions appear in review panel | Each has question text, 4 options, correct answer marked |
| 6 | Edit one question inline | Edit works |
| 7 | Click "Save All" | Questions saved to selected topic |
| 8 | Check credit balance | Reduced by **10 credits**. Transaction type: `quiz_generation` |

**Expected:** ✅ AI generates questions. Credits deducted.

---

### TC-CAT-08: AI Generation — Mixed Questions

**User:** PRO_USER. Precondition: Credits ≥ 6.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | AI Generation, select type: "Mixed", quantity: 10 | — |
| 2 | Generate | Questions include MCQ, True/False, and Short Answer types |
| 3 | Check credits | Reduced by **6 credits** |

**Expected:** ✅ Mixed generates variety. 6 credits deducted (not 10 or 3).

---

### TC-CAT-09: AI Generation — Insufficient Credits

**Precondition:** PRO_USER has 0 credits.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attempt any AI generation | Error: "Insufficient credits. Please purchase more." |
| 2 | No generation happens | Credits remain at 0 |

**Expected:** ✅ Blocked with clear error. No silent deduction.

---

### TC-CAT-10: AI Generation — Free Plan Blocked

**User:** FREE_USER (individual_starter — AI disabled)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attempt AI generation | Plan gate dialog: "AI features require Individual Pro or higher. Upgrade your plan." |
| 2 | Generation form not accessible | — |

**Expected:** ✅ AI locked. Upgrade prompt shown.

---

### TC-CAT-11: OCR Image Scan

**User:** PRO_USER. Precondition: Clear photo of a printed question.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | "Add Questions" → "Image Scan" | Upload area appears |
| 2 | Upload photo | Preview shown |
| 3 | Click "Scan" | OCR processes. 3-10 seconds |
| 4 | Extracted questions appear | Review panel with extracted text |
| 5 | Edit any misread text | Inline editing works |
| 6 | Save | Questions saved. **2 credits** deducted per image |

**Expected:** ✅ OCR works. 2 credits deducted.

---

### TC-CAT-12: Question Bank Limit (Free Plan)

**User:** FREE_USER. Precondition: Already has 99 questions.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Try to add question #101 | Block or warning: "Question bank limit reached (100). Upgrade to add more." |

**Expected:** ✅ Limit enforced.

---

### TC-CAT-13: Edit Existing Question

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In topic view, click edit (pencil) on a question | Edit form opens, pre-filled |
| 2 | Change question text | — |
| 3 | Save | Updated. Toast shown |

**Expected:** ✅ Edit persists.

---

### TC-CAT-14: Delete a Question

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click delete (trash) on a question | Confirm dialog |
| 2 | Confirm | Question removed from list |
| 3 | Database | Row deleted from `questions` |

**Expected:** ✅ Delete works with confirmation.

---

## 8. Module 3 — Participant Management

### 8.1 Feature Overview

Participants are organised in two levels in the actual UI:

| UI Label | Description | Example |
|----------|-------------|---------|
| **Type** | Top-level grouping | "Class X", "General", "Batch 2026" |
| **Group** | Sub-level inside a Type | "Section A", "Boys", "Morning Shift" |
| **People** | Individual participants inside a Group | "Ali Khan", "Sara Ahmed" |

> **MVP Note:** CSV bulk participant import is **not available**. Participants are added manually or via invite links only.

---

### TC-PAR-01: Create a Participant Type

**User:** PRO_USER

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to "Participants" in sidebar | Page loads. Shows Type / Group / People breadcrumb tabs |
| 2 | Click "New Type" | Dialog opens |
| 3 | Enter name: "Class X" | Accepted |
| 4 | Create | Type chip appears (e.g., "General 4" — or new "Class X") |
| 5 | Database | `participant_types` row with `owner_id = PRO_USER.id` |

**Expected:** ✅ Type created.

---

### TC-PAR-02: Create a Group Inside a Type

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click on "Class X" type | Type detail view. Group tab active |
| 2 | Click "New Group" | Dialog |
| 3 | Enter name: "Section A" | — |
| 4 | Create | Group appears |
| 5 | Database | `participant_subtypes` row linked to type |

**Expected:** ✅ Group created inside Type.

---

### TC-PAR-03: Add Participant Manually

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to "Add Participants" or "+" in People view | Method tabs appear |
| 2 | Select "Manual" tab | Form loads |
| 3 | Select Type: "Class X", Group: "Section A" | — |
| 4 | Enter: name = "Ali Khan", email = "ali@test.com", roll = "001" | Fields accept |
| 5 | Click "Add" | Participant appears in People list of Section A |

**Expected:** ✅ Participant added manually.

---

### TC-PAR-04: Invite Participant via Email Link

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | "Add Participants" → "Invite" tab | Email invite form |
| 2 | Select Type & Group | — |
| 3 | Enter email: "student@test.com" | — |
| 4 | Click "Send Invite" | Invite email sent. `invites` row created in DB |
| 5 | Check inbox | Email with invite link received |
| 6 | Click link | `/invite/$token` page loads. Shows platform name and "Accept" button |
| 7 | Fill registration form, click Accept | Participant added to the group |

**Expected:** ✅ Email invite → acceptance → participant added.

---

### TC-PAR-05: Generate Reusable Invite Link

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In Type or Group page, click "Generate Invite Link" | Shareable URL generated |
| 2 | Share link with multiple people | — |
| 3 | Person 1 opens link | `/invite/$token` page. Registration form |
| 4 | Person 1 fills and submits | Added to group |
| 5 | Same link used by Person 2 | Also accepted. Both now in group |
| 6 | If `max_uses` configured | Link deactivates after that many uses |

**Expected:** ✅ Reusable invite links work for multiple participants.

---

### TC-PAR-06: Participant Total Limit (Free Plan)

**User:** FREE_USER. Precondition: 49 participants already exist.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Try to add participant #51 | Block: "Total participant limit reached (50). Upgrade to add more." |

**Expected:** ✅ Limit enforced.

---

### TC-PAR-07: View Participant Stats

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to a group with participants (People view) | Participants listed |
| 2 | Click a participant row | Stats panel opens: quizzes attended, average score, completion rate |

**Expected:** ✅ Stats panel shows.

---

### TC-PAR-08: Participant Type Member Lock on Invite

**Precondition:** Host set `participant_type` when generating invite link.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Invite link is generated for a specific participant type | — |
| 2 | Recipient opens link | Registration form shows. They cannot change which group they're joining |
| 3 | They submit | Added to the correct pre-assigned group only |

**Expected:** ✅ Participant type is locked by host when generating the invite. Participant cannot change it.

---

## 9. Module 4 — Session Creation & Configuration

### 9.1 Feature Overview

Sessions are quiz events. Types: Live (host-controlled), QR Link (self-paced), or Scheduled (auto-start).

---

### TC-SES-01: Create a Live Quiz Session

**User:** PRO_USER. Precondition: Category and questions exist.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | "Sessions" → "New Session" | Multi-step form loads |
| 2 | Title: "Algebra Quiz 1" | Accepted |
| 3 | Select category: Mathematics, topic: Algebra | Dropdowns work |
| 4 | Set questions: 10, type: MCQ, difficulty: Mixed | Config accepted |
| 5 | Time per question: 30 seconds | Accepted |
| 6 | Participant mode: Public | Toggle on (anyone with code can join) |
| 7 | Click "Create Session" | Session created. Redirects to session lobby |
| 8 | Access code visible | 6-character code + QR code displayed |

**Expected:** ✅ Session created. Code and QR visible.

---

### TC-SES-02: Create a Scheduled Session

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Toggle "Schedule for Later" | Date/time picker appears |
| 2 | Select future date/time | Accepted |
| 3 | Create session | `status = 'scheduled'`, `scheduled_at` set |
| 4 | Sessions list | "Scheduled" badge with date/time |
| 5 | At scheduled time | Session auto-activates (`status → 'active'`) |

**Expected:** ✅ Scheduled session auto-starts.

---

### TC-SES-03: Closed-Roster Session

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Disable "Public" mode in session config | — |
| 2 | Add participant group: "Class X > Section A" | Added to roster |
| 3 | Create | Session with closed roster |
| 4 | Participant NOT in roster tries to join | Error: "You are not registered for this session." |
| 5 | Participant IN roster joins | Allowed |

**Expected:** ✅ Closed roster enforced.

---

### TC-SES-04: Daily Limit Enforcement (Free Plan)

**User:** FREE_USER. Precondition: Already created 3 sessions today.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Try to create session #4 | Plan gate: "Daily quiz limit reached (3/3). Upgrade to create more." |

**Expected:** ✅ Daily limit enforced.

---

### TC-SES-05: Edit Session (Pre-Start)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open `draft` or `scheduled` session | Lobby page |
| 2 | Click "Edit" | Edit dialog with current config |
| 3 | Change title | Accepted |
| 4 | Save | Title updated |

**Expected:** ✅ Pre-start editing works.

---

### TC-SES-06: Show Results After Quiz Toggle

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create session with "Show results after quiz" = ON | — |
| 2 | Participant completes quiz | Results page shown immediately |
| 3 | Create session with toggle = OFF | — |
| 4 | Participant completes | "Quiz submitted." message only — no scores shown |

**Expected:** ✅ Toggle controls participant result visibility.

---

## 10. Module 5 — Live Quiz (Host Side)

### 10.1 Feature Overview

The host controls the quiz from the session page: lobby, start, question progression, real-time monitoring, and end.

---

### TC-HOST-01: Lobby — Real-Time Participant Join

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open session page (`draft` status) | Lobby visible. Code + QR shown. "Start Quiz" button present |
| 2 | PARTICIPANT_1 joins using the code | Their name appears in attendee list within 2 seconds (no refresh) |
| 3 | PARTICIPANT_2 joins | Second name appears. Count updates |

**Expected:** ✅ Real-time join — no page refresh needed.

---

### TC-HOST-02: Start Quiz

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | At least 1 participant in lobby | "Start Quiz" button enabled |
| 2 | Click "Start Quiz" | `status → active`. Host sees Question 1 view |
| 3 | Participant side (same moment) | Participant lobby → Question 1 transition |
| 4 | Timer visible | Countdown running |

**Expected:** ✅ Session starts. All participants see Question 1 simultaneously.

---

### TC-HOST-03: Real-Time Answer Tracking

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Question 1 live | "X/Y answered" counter = 0/2 |
| 2 | PARTICIPANT_1 answers | Counter → 1/2 within 2 seconds |
| 3 | PARTICIPANT_2 answers | Counter → 2/2 |
| 4 | Timer expires / host advances | Next question shown |

**Expected:** ✅ Answer counter live.

---

### TC-HOST-04: End Quiz

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | After last question | "End Quiz" button |
| 2 | Click "End Quiz" | `status → completed`. Results view loads |
| 3 | Results summary | Per-participant scores, rankings, pass/fail |

**Expected:** ✅ Quiz ends cleanly. Results immediate.

---

### TC-HOST-05: Live Leaderboard

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | During quiz (2+ participants) | Leaderboard tab visible |
| 2 | Switch to leaderboard | Participants ranked by score |
| 3 | After each question | Rankings update live |

**Expected:** ✅ Leaderboard updates per question.

---

### TC-HOST-06: Session Activity Panel

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Activity Panel during session | Log shows: "Ali Khan joined", "Question 1 answered by Ali Khan", etc. |

**Expected:** ✅ Real-time activity log running.

---

## 11. Module 6 — Live Quiz (Participant Side / Public)

### 11.1 Feature Overview

Participants join via `/q/$code`. No account needed. They register, wait in lobby, answer questions, and optionally see results.

---

### TC-PART-01: Anonymous Participant — Full Journey

**Precondition:** Active session exists.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/q/XXXXXX` | Registration form loads |
| 2 | Enter: name "Ali Khan", email "ali@test.com" | Fields accept |
| 3 | Click "Join" | Lobby: "Waiting for host to start…" |
| 4 | Host starts quiz | Participant sees Question 1 |
| 5 | Answer within timer | Answer recorded |
| 6 | All questions done | "Quiz submitted!" |
| 7 | If results enabled | Score and correct answers shown |

**Expected:** ✅ Full participant journey works end to end.

---

### TC-PART-02: Invalid Code

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/q/BADCODE` | Error: "Session not found or has expired." |

**Expected:** ✅ Graceful error.

---

### TC-PART-03: Join Completed Session

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Session is `completed` | Error: "This session has already ended." |

**Expected:** ✅ No entry after session ends.

---

### TC-PART-04: Closed Roster — Not on List

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter email not in roster | Error: "You are not registered for this session." |

**Expected:** ✅ Blocked. Clear error.

---

### TC-PART-05: Closed Roster — On List

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter email that IS in roster | Allowed to join |

**Expected:** ✅ Roster participant allowed.

---

### TC-PART-06: Timer Expiry Auto-Submit

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Participant does NOT answer within time | Timer expires. Auto-advances to next question |
| 2 | Unanswered question | Recorded as blank / 0 score |

**Expected:** ✅ No stuck state. Auto-advance works.

---

### TC-PART-07: All Question Types — Rendering and Submission

| Step | Question Type | Expected UI | Expected on Submit |
|------|--------------|-------------|--------------------|
| 1 | MCQ | 4 clickable option buttons | Selected option highlighted. Moves to next Q |
| 2 | True/False | Two buttons: True / False | — |
| 3 | Short Answer | Single-line text input | Text submitted |
| 4 | Long Answer | Multi-line text area | Text submitted |

**Expected:** ✅ All question types render correctly. All answer types recorded in `quiz_attempt_answers`.

---

### TC-PART-08: Results Page

**Precondition:** `show_results_after_quiz = true`.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Final question submitted | Results page appears |
| 2 | Shows | Total score, correct/incorrect count, time taken |
| 3 | For MCQ/T-F | Which answers were right/wrong |

**Expected:** ✅ Score breakdown shown.

---

## 12. Module 7 — Grading (Manual & AI)

### 12.1 Feature Overview

After a session with Short Answer or Long Answer questions, the host grades the responses — manually or via AI.

---

### TC-GRD-01: Access Grading Page

**Precondition:** Completed session with short/long answer questions.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open session results page | "Grade Answers" button OR "Grading Pending" banner |
| 2 | Click it | Navigates to `/sessions/$id/grade` |
| 3 | Mode selection | "Manual Grading" and "AI Grading" options |

**Expected:** ✅ Grading page accessible.

---

### TC-GRD-02: Manual Grading

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select "Manual Grading" | All participant answers listed |
| 2 | Enter score (e.g., 3/5) for an answer | Numeric input works |
| 3 | Enter optional feedback | Feedback field works |
| 4 | Click "Save Grade" | Saved immediately |
| 5 | After all graded, click "Finalize" | All attempts → `graded`. Overall scores updated |

**Expected:** ✅ Manual grades saved and finalized.

---

### TC-GRD-03: AI Grading

**User:** PRO_USER. Precondition: AI enabled, credits available.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select "AI Grading" | Setup form loads |
| 2 | Enter rubric: "Award 5 marks for a complete answer listing 3+ causes." | Accepted |
| 3 | Select tone: "Balanced" | Selected |
| 4 | Click "Start AI Grading" | Loading. 10-30 seconds |
| 5 | AI Review screen | All answers with AI scores and feedback |
| 6 | Check credits | **1 credit** per 10 short answers, **3 credits** per 10 long answers deducted |

**Expected:** ✅ AI grades generated. Credits deducted correctly.

---

### TC-GRD-04: Review and Override AI Grades

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | AI Review screen | Participant name, answer, AI score, AI feedback visible per row |
| 2 | Override a score | Type new value in score field |
| 3 | Click "Finalize Grades" | All scores (including overrides) saved |

**Expected:** ✅ AI grades reviewable and overridable.

---

### TC-GRD-05: AI Grading Blocked on Free Plan

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | FREE_USER tries AI grading | Plan gate: "AI grading requires Individual Pro or higher." |

**Expected:** ✅ Blocked with upgrade prompt.

---

## 13. Module 8 — Reports & Analytics

### 13.1 Feature Overview

After a session, hosts view summary stats, per-question analysis, and individual student reports. CSV export available.

---

### TC-REP-01: Quiz Summary Report

**Precondition:** At least 1 completed, graded session.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/reports` | Report page loads |
| 2 | Select completed session | Data loads |
| 3 | Summary tab | Total participants, average score, pass rate, total duration |

**Expected:** ✅ Summary stats correct.

---

### TC-REP-02: Per-Question Analysis

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | "Question Analysis" tab | All questions in session listed |
| 2 | Each question shows | % answered correctly, average time, difficulty |
| 3 | Questions with <40% correct | Highlighted as difficult |

**Expected:** ✅ Per-question breakdown accurate.

---

### TC-REP-03: Individual Student Report

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | "Student Reports" tab | All participants listed |
| 2 | Click a participant | Full answer sheet: each question, their answer, score, feedback |

**Expected:** ✅ Individual report readable.

---

### TC-REP-04: Export CSV

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Export CSV" | Download starts |
| 2 | Open CSV | Participants, scores, per-question answers |
| 3 | Free/Starter plan | Watermark in filename or footer (`file_export_watermark = true`) |

**Expected:** ✅ CSV downloads. Watermark present on free plans.

---

### TC-REP-05: Date Range Filter

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open filter panel | Date picker available |
| 2 | Set date range | Only sessions in that range shown |

**Expected:** ✅ Date filter works.

---

### TC-REP-06: Quiz History Page

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/quiz-history` | All past sessions as cards |
| 2 | Filter by "Completed" | Only completed sessions |
| 3 | Search by title | Matching titles only |
| 4 | Click a card | Opens session detail/results |

**Expected:** ✅ History page filters work.

---

## 14. Module 9 — Billing, Plans & Credits

### 14.1 Feature Overview

Users view their plan, upgrade, buy credit packages, and track transactions. Payments are manual (bank transfer + proof upload).

---

### TC-BIL-01: View Current Plan & Credits

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/billing` | Overview loads |
| 2 | Plan shown | Plan name, features, current usage |
| 3 | Credit balance | Current balance, total earned, total spent |
| 4 | Recent transactions | Chronological list |

**Expected:** ✅ Billing overview accurate.

---

### TC-BIL-02: Plan Upgrade Flow

**User:** FREE_USER upgrading to Individual Pro

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Upgrade Plan" | Plan selection step |
| 2 | Select "Individual Pro" (PKR 999/month) | Card highlighted |
| 3 | "Proceed to Payment" | Bank transfer details shown |
| 4 | Make payment externally | — |
| 5 | Upload proof/screenshot | File upload works |
| 6 | Submit | "Upgrade pending admin approval." |
| 7 | Admin approves (admin panel) | Plan badge changes to Individual Pro |
| 8 | Check user profile | `profiles.selected_plan` also updated |
| 9 | User logs in after approval | Sees Individual Pro. No auto-downgrade |

**Expected:** ✅ Full upgrade flow end to end. Plan persists after login.

---

### TC-BIL-03: Buy Credit Package (Pro Plan)

**User:** PRO_USER (can_buy_credits = true)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Billing → "Buy Credits" | Packages listed: Starter 50c/PKR 199, Value 100c/PKR 399, Power 150c/PKR 499 |
| 2 | Select "Value Pack" | Selected |
| 3 | Payment flow + upload proof | — |
| 4 | Admin approves | +100 credits added. Transaction recorded |

**Expected:** ✅ Credit purchase works.

---

### TC-BIL-04: Free Plan Cannot Buy Credits

**User:** FREE_USER

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to billing | "Buy Credits" not shown or locked with plan gate |

**Expected:** ✅ Credit purchase blocked on free plan.

---

### TC-BIL-05: Promo Code Application

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | On payment step, enter valid promo code | Discount applied. Total price reduced |
| 2 | Enter expired/invalid code | Error: "Invalid or expired promo code." |

**Expected:** ✅ Valid codes discount. Invalid rejected.

---

### TC-BIL-06: Credit Transaction History

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In billing overview | Full transaction list |
| 2 | Each row | Date, signed amount (+/-), type, reason, balance after |
| 3 | AI generation row | Type = `quiz_generation` |
| 4 | Admin credit row | Type = `admin_adjustment` |

**Expected:** ✅ Full audit trail visible.

---

### TC-BIL-07: Enterprise Trial Expiry → Enterprise Free

**User:** ENT_ADMIN (enterprise_starter, 15-day trial)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | < 7 days remaining | Warning banner: "Trial expires in X days. Upgrade to keep full access." |
| 2 | Trial expires | Plan auto-downgrades to **Enterprise Free** (NOT Individual Free) |
| 3 | Enterprise Free limits | 3 quizzes/day, 50 participants, 100 questions, **up to 3 hosts** still active |
| 4 | AI features | Blocked. Plan gate shown |
| 5 | Banner shows | "Trial expired. You're now on Enterprise Free." |

**Expected:** ✅ Downgrades to Enterprise Free, NOT Individual Free. Org team access preserved (3 hosts).

---

## 15. Module 10 — Organisation / Enterprise

### 15.1 Feature Overview

Enterprise admins manage a company profile, invite host teachers, allocate credits to them, and approve credit requests.

---

### TC-ORG-01: Enterprise Onboarding Wizard

**User:** ENT_ADMIN (first login)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `/company` | Onboarding wizard launches automatically |
| 2 | Step 1 — Company details: name, type (University), address, phone | Fields accept |
| 3 | Step 2 — Upload company logo | Upload works |
| 4 | Step 3 — Review | Summary shown |
| 5 | "Complete Setup" | `onboarding_completed = true`. Dashboard loads |

**Expected:** ✅ Onboarding saves company profile.

---

### TC-ORG-02: Invite a Host to Organisation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `/company` → Team tab | Team list |
| 2 | "Invite Member" | Dialog: email, role (Host), department |
| 3 | Send invite | `company_members` row (status=pending). Invite email sent |
| 4 | Host receives email | Invite link in email |
| 5 | Host clicks link → accepts | `status = active`. `user_id` linked |
| 6 | Back in Team tab | Member shows "Active" |

**Expected:** ✅ Invite → accept flow complete.

---

### TC-ORG-03: Transfer Credits to Host

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `/company` → Credits tab | Org balance shown |
| 2 | "Transfer Credits" next to a host | Transfer dialog |
| 3 | Amount: 50, confirm | Org balance -50. Host balance +50 |
| 4 | Transactions recorded | Both users' `credit_transactions` updated |

**Expected:** ✅ Credit transfer immediate on both sides.

---

### TC-ORG-04: Host Requests More Credits

**User:** ENT_HOST

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | ENT_HOST clicks "Request Credits" | Form: amount, note |
| 2 | Submit: amount=100, "Exam week" | `credit_requests` row (pending). Admin notified |
| 3 | ENT_ADMIN opens requests tab | Pending request listed |
| 4 | Approve | Credits transferred. Request approved. ENT_HOST notified |

**Expected:** ✅ Request → approval flow works.

---

### TC-ORG-05: Decline Credit Request

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | ENT_ADMIN sees pending request | — |
| 2 | Click "Decline" | `status = declined`. ENT_HOST notified |

**Expected:** ✅ Decline works. Notification sent.

---

### TC-ORG-06: Host Dashboard Shows Org Plan

**User:** ENT_HOST

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | ENT_HOST logs in | `HostDashboard` loads (not OwnerDashboard) |
| 2 | Plan shown | Org plan (Enterprise Pro/Trial) — not personal plan |
| 3 | Credits shown | ENT_HOST's allocated balance only |

**Expected:** ✅ Host sees org plan and own balance.

---

### TC-ORG-07: Company Profile Edit

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `/company` → Overview tab → "Edit Profile" | Edit dialog |
| 2 | Change company name | — |
| 3 | Save | Updated immediately |

**Expected:** ✅ Profile edit saves.

---

### TC-ORG-08: Remove a Team Member

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Team tab → find active host | Row shows "Active" |
| 2 | Remove/Deactivate | Confirm dialog |
| 3 | Confirm | `company_members.status = inactive` |
| 4 | Member logs in | Shown as individual user, no org access |

**Expected:** ✅ Deactivation removes org access.

---

## 16. Module 11 — Settings & Profile

---

### TC-SET-01: Update Profile

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `/settings` → Profile tab | Profile form |
| 2 | Change full name | Editable |
| 3 | Upload avatar | Image upload works |
| 4 | Change preferred language | Language selector works |
| 5 | Save | Toast: "Profile updated." Persists on refresh |

**Expected:** ✅ Profile fields save.

---

### TC-SET-02: Host Settings — Registration Fields

**User:** ENT_ADMIN (Enterprise plan)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Settings → "Host Settings" tab | Registration fields config |
| 2 | Enable "Roll Number" as required | Toggle + required checkbox |
| 3 | Disable "Mobile" | Toggle off |
| 4 | Save | When participant joins session: roll number required, mobile not shown |

**Expected:** ✅ Registration form matches host settings.

---

### TC-SET-03: Scoring Settings

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Host Settings → Scoring section | — |
| 2 | Set marks per correct answer = 2 | Input accepts |
| 3 | Enable Speed Bonus | Toggle on |
| 4 | Max speed bonus = 5 | Accepted |
| 5 | Save | New sessions use updated scoring rules |

**Expected:** ✅ Scoring configurable.

---

### TC-SET-04: Custom Message Templates (Enterprise Pro Only)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Settings → "Messages" tab | Template editor |
| 2 | Edit Welcome Message | Text editor works |
| 3 | Save | Shown to participants at quiz start |

**Expected:** ✅ Custom messages save and display.

---

## 17. Module 12 — Notifications

---

### TC-NOT-01: Unread Count Badge

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | At least 1 unread notification | Bell icon shows red badge with count |
| 2 | Click bell | Dropdown opens with notification list |

**Expected:** ✅ Badge visible.

---

### TC-NOT-02: Mark as Read

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open dropdown | Unread notifications listed |
| 2 | Click notification | Marks read. Badge count decreases |
| 3 | "Mark all read" | Badge disappears |

**Expected:** ✅ Read tracking works.

---

### TC-NOT-03: Real-Time Delivery

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | ENT_HOST logged in on dashboard | — |
| 2 | ENT_ADMIN approves credit request | — |
| 3 | ENT_HOST bell icon | Updates within 2 seconds. "Credit request approved." |

**Expected:** ✅ Notification delivered without page refresh.

---

### TC-NOT-04: Trial Expiry Warning

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | ENT_ADMIN has < 7 days on trial | Notification: "Your trial expires in X days." |

**Expected:** ✅ Warning sent.

---

## 18. Module 13 — Admin Panel

### 18.1 Feature Overview

`/admin` is accessible only to users with the `admin` role. Full platform control.

---

### TC-ADM-01: Access Control

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | FREE_USER navigates to `/admin` | Redirect or "Access denied." |
| 2 | ADMIN_USER navigates to `/admin` | Admin dashboard loads |

**Expected:** ✅ Non-admins blocked.

---

### TC-ADM-02: Overview Stats

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open Overview tab | Total users, sessions, questions, participants, active subscriptions |

**Expected:** ✅ Stats load.

---

### TC-ADM-03: User Management

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Users tab | Table: name, email, plan, status, counts |
| 2 | Search by name/email | Filters work |
| 3 | Filter by plan | Correct users shown |
| 4 | Expand user | Detail: sub history, sessions, payments |

**Expected:** ✅ User list with search and filter works.

---

### TC-ADM-04: Admin Changes User Plan (Critical — Must Not Auto-Downgrade)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | In user detail, click plan change button "individual_pro" | — |
| 2 | `admin_assign_plan` RPC called | Updates BOTH `user_subscriptions.plan_id` AND `profiles.selected_plan` atomically |
| 3 | Verify subscription | `plan_id = individual_pro`. `expires_at = null` |
| 4 | Verify profile | `selected_plan = 'individual_pro'` |
| 5 | User logs in | Sees Individual Pro. Does NOT revert to free |
| 6 | User logs in again (multiple times) | Still Individual Pro each time |

**Expected:** ✅ Plan change persists. No auto-downgrade on login.

---

### TC-ADM-05: Plan Limits Edit

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Plans tab | All plans with limits |
| 2 | Edit "Individual Free" | Form opens |
| 3 | Change `quizzes_per_day` from 3 to 5 | Accepted |
| 4 | Save | Updated. Free users now get 5/day |

**Expected:** ✅ Plan limits editable from admin.

---

### TC-ADM-06: Credit Packages — Update Prices

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Credit Packages tab | Current packages listed |
| 2 | Edit "Value Pack": verify 100 credits at PKR 399 | Accepted |
| 3 | Save | Billing page reflects updated Value Pack |

**Expected:** ✅ Credit package prices update and reflect immediately.

---

### TC-ADM-07: Manual Credit Adjustment

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Credits tab → search PRO_USER | Found |
| 2 | "Adjust Credits" | Dialog: amount + reason |
| 3 | Add 100 credits | Balance updated. Transaction type = `admin_adjustment` |

**Expected:** ✅ Manual adjustment works.

---

### TC-ADM-08: Promo Code CRUD

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Promo Codes tab | Existing codes listed |
| 2 | Create "LAUNCH50" — 50% discount, 100 max uses | Created |
| 3 | Test code in billing | 50% off applied |
| 4 | Deactivate | Code no longer works |

**Expected:** ✅ Promo code lifecycle works.

---

### TC-ADM-09: Activity Logs

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Activity Logs tab | Chronological user actions |
| 2 | Filter by user | Only that user's actions |
| 3 | Each entry | Timestamp, user, action type, resource |

**Expected:** ✅ Audit trail complete.

---

### TC-ADM-10: Finance Section

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Finance tab | Revenue overview, MRR, subscription counts |
| 2 | Payment history | List of approved manual payments |

**Expected:** ✅ Finance data visible.

---

### TC-ADM-11: AI Usage Tracking

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | AI Usage tab | AI calls per user, per time period |

**Expected:** ✅ Visible for cost monitoring.

---

### TC-ADM-12: Approve Manual Payment

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | User submitted payment proof | Pending payment in admin |
| 2 | Admin reviews proof | Proof image visible |
| 3 | Approve | Credits added OR plan upgraded. User notified |
| 4 | Reject | Payment declined. User notified |

**Expected:** ✅ Payment approval/rejection workflow complete.

---

## 19. Module 14 — Security & Permission Checks

---

### TC-SEC-01: User Cannot See Another User's Questions

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login as FREE_USER | — |
| 2 | Navigate to `/categories/$categoryIdOfProUser` | Empty or error — PRO_USER's data not visible |

**Expected:** ✅ RLS isolates question data by owner.

---

### TC-SEC-02: User Cannot See Another User's Sessions

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login as FREE_USER | — |
| 2 | Navigate to `/sessions/$sessionIdOfProUser` | Error or session not found |

**Expected:** ✅ Sessions isolated by owner.

---

### TC-SEC-03: Participant Has Zero Access to Host Data

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Participant joins quiz via `/q/$code` | Quiz UI only |
| 2 | Navigate to `/dashboard` | Redirect to `/login` |
| 3 | Direct Supabase query attempt | RLS returns 0 rows |

**Expected:** ✅ Participants cannot access host data.

---

### TC-SEC-04: Admin Can Read All Data

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | ADMIN_USER in Users tab | All users visible |
| 2 | ADMIN_USER views sessions | All sessions across all owners visible |

**Expected:** ✅ Admin has full read access.

---

### TC-SEC-05: Non-Admin Cannot Call Admin RPCs

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | FREE_USER calls `admin_assign_plan` RPC | Error: "Permission denied" |

**Expected:** ✅ Admin RPCs protected by `has_role()` check.

---

### TC-SEC-06: AI Plan Gate (UI + Server Level)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | FREE_USER tries AI in UI | Plan gate dialog shown |
| 2 | FREE_USER bypasses UI, calls server function directly | Error: "AI not enabled for your plan" |

**Expected:** ✅ AI blocked at both UI and server.

---

### TC-SEC-07: Credit Deduction Integrity

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | PRO_USER has exactly 5 credits. Tries 10 MCQ generation (costs 10) | Error: "Insufficient credits." |
| 2 | Credits remain at 5 | No partial deduction on failure |

**Expected:** ✅ No partial deduction.

---

## 20. Cross-Cutting Real-Time Tests

---

### TC-RT-01: Lobby Join Latency

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Host on lobby page | Empty attendee list |
| 2 | Participant joins in second browser | Name appears in < 2 seconds (no refresh) |
| 3 | 5 participants join simultaneously | All appear in real time |

**Expected:** ✅ < 2s latency.

---

### TC-RT-02: Question Progression

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Host advances to next question | Participant sees it within 1-2 seconds |

**Expected:** ✅ No page refresh needed.

---

### TC-RT-03: Answer Count Live

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Host watching counter (0/2) | — |
| 2 | Participant 1 answers | Counter → 1/2 within 2s |
| 3 | Participant 2 answers | Counter → 2/2 |

**Expected:** ✅ Answer tracking real-time.

---

### TC-RT-04: Notification Push

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | User on dashboard | Bell count = 0 |
| 2 | System event triggers notification | Bell count updates within 2s |

**Expected:** ✅ Push without refresh.

---

## 21. UAT Sign-Off Sheet

| Module | TCs | Passed | Failed | Blocked | Tester | Date | Sign-Off |
|--------|-----|--------|--------|---------|--------|------|----------|
| Module 1 — Auth & Signup | 10 | | | | | | |
| Module 2 — Question Bank | 14 | | | | | | |
| Module 3 — Participants | 8 | | | | | | |
| Module 4 — Session Creation | 6 | | | | | | |
| Module 5 — Live Quiz (Host) | 6 | | | | | | |
| Module 6 — Live Quiz (Participant) | 8 | | | | | | |
| Module 7 — Grading | 5 | | | | | | |
| Module 8 — Reports | 6 | | | | | | |
| Module 9 — Billing & Credits | 7 | | | | | | |
| Module 10 — Organisation | 8 | | | | | | |
| Module 11 — Settings | 4 | | | | | | |
| Module 12 — Notifications | 4 | | | | | | |
| Module 13 — Admin Panel | 12 | | | | | | |
| Module 14 — Security | 7 | | | | | | |
| Real-Time Tests | 4 | | | | | | |
| **TOTAL** | **109** | | | | | | |

### Acceptance Criteria

| Condition | Requirement |
|-----------|-------------|
| Critical path flows (auth, session, live quiz, billing) | 100% PASS |
| Blocking bugs at sign-off | 0 |
| Data isolation (RLS failures) | 0 — any failure is a blocker |
| Credit integrity (wrong deduction) | 0 — any failure is a blocker |
| Plan persistence after login (no auto-downgrade) | 0 failures |
| Real-time latency | < 2 seconds for all events |
| Page load time | < 3 seconds on broadband |

---

## 22. Bug Report Template

```
BUG REPORT
──────────────────────────────────────────────────
ID:           BUG-[MODULE]-[NNN]   e.g., BUG-AUTH-001
Title:        [Short description]
Test Case:    [TC-XXX-NN]
Severity:     CRITICAL / HIGH / MEDIUM / LOW
Priority:     P1 / P2 / P3

Environment:
  Browser:     Chrome 125 / Firefox 126 / Safari 17
  Account:     FREE_USER / PRO_USER / ENT_ADMIN / ADMIN_USER
  Plan:        individual_starter / individual_pro / enterprise_starter / etc.
  Date/Time:   2026-05-25 14:30 PKT

Steps to Reproduce:
  1.
  2.
  3.

Expected Result:
  [What should have happened]

Actual Result:
  [What actually happened — be specific]

Console Errors (if any):
  [Paste from browser DevTools → Console]

Network Errors (if any):
  [Paste from browser DevTools → Network tab]

Screenshot / Recording:
  [Attach or link]
──────────────────────────────────────────────────
```

### Severity Guide

| Severity | Definition | Examples |
|----------|------------|---------|
| CRITICAL | Data loss, security breach, platform unusable | User sees another user's data. Cannot log in at all. |
| HIGH | Core feature broken, no workaround | Cannot create session. Cannot join quiz. Plan upgrade has no effect. |
| MEDIUM | Feature broken but workaround exists | CSV export has wrong column. Filter doesn't remember state. |
| LOW | Cosmetic / minor UX | Typo in label. Button misaligned on mobile. |

---

## 23. User Guidance — Step-by-Step Feature Guide

> **This section is for end users.** Plain-language instructions for every major feature.

---

### GUIDE 1: Creating Your Account

#### Sign Up (2 Steps)

**Step 1** — Go to the platform and click **Sign Up**.

**Step 2 — Your Profile** — Fill in:
- **First name** and **Last name**
- **I am a...** — select your role: Student, Teacher, Employer, or Other
- **Mobile** (optional)
- **Email** — any email address (Gmail, Yahoo, company email — all accepted)
- **Password** — must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character (e.g., `Test@1234`)
- **I want to use this for** — select one or more: Education, Sports, Fun, Religion, Science, Academic
- **How did you hear about us** — select one: Ads, Friend Recommendation, Employee Referral, Web Search
- **Account type** — shown at the bottom. Defaults to **Personal**. Click **Change** to switch to **Enterprise** (for schools and organisations — includes a 15-day free trial)

Click **Create Account**.

#### Account Types

| Type | Who It's For | Plan Assigned |
|------|-------------|---------------|
| **Personal** | Individual teacher, trainer, student | Individual Free |
| **Enterprise** | School, company, training centre | Enterprise Trial (15 days) |

> No email domain restriction. You can use Gmail or any other email for Enterprise.

#### Password Rules

Your password must contain all of the following:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*)

---

### GUIDE 2: Building Your Question Bank

Questions live inside **Categories** → **Topics** (two levels of organisation).

#### Create a Category

1. Click **Questions** in the left sidebar.
2. Click **+** or **New Category**.
3. Enter a name (e.g., "Mathematics") and click **Create**.

#### Create a Topic

1. Click into your category.
2. Click **New Topic**.
3. Enter a name (e.g., "Algebra") and click **Create**.

#### Add Questions — Manual Entry

1. Click **Add Questions** → **Manual Entry**.
2. Select your category and topic.
3. Choose the question type:
   - **MCQ** — Multiple choice with 2–6 options. You mark which is correct.
   - **True/False** — Two options only.
   - **Short Answer** — Student types a short text answer. You can set a reference answer.
   - **Long Answer** — Essay-style. Must be graded manually or with AI after the quiz.
4. Write the question, fill the options, set difficulty.
5. Click **Save Question**.

#### Add Questions — AI Generation *(Individual Pro & Enterprise)*

1. Click **Add Questions** → **AI Generation**.
2. Choose question type and quantity.
3. Type a prompt describing what you want:
   > *"10 MCQ questions about the French Revolution, medium difficulty, for Grade 10 students."*
4. Click **Generate**. Wait 5–20 seconds.
5. Review the generated questions. Edit any you want to change.
6. Click **Save All**.

**Credit costs:**
| Type | Credits per 10 questions |
|------|------------------------|
| MCQ | 10 |
| True/False | 3 |
| Short Answer | 5 |
| Long Answer | 10 |
| **Mixed** (variety of types) | **6** |

> Mixed is the best value if you want different question types in one batch. It generates a combination of MCQ, True/False, and Short Answer questions.

#### Add Questions — Image Scan (OCR) *(Individual Pro & Enterprise)*

1. Take a clear photo of a printed question sheet.
2. Click **Add Questions** → **Image Scan**.
3. Upload the image and click **Scan**.
4. Review extracted questions and correct errors if any.
5. Click **Save All**. (Costs 2 credits per image.)

---

### GUIDE 3: Managing Participants

Participants are organised in two levels:

| Level | Example | What It Is |
|-------|---------|------------|
| **Type** | "Class X", "Batch 2026" | The top-level group |
| **Group** | "Section A", "Boys", "Morning" | Sub-group inside a Type |

#### Create a Type and Group

1. Click **Participants** in the sidebar.
2. Click **New Type** → name it "Class X" → Create.
3. Click into "Class X" → **New Group** → name it "Section A" → Create.

#### Add Participants — Manual

1. Click **Add Participants** → **Manual** tab.
2. Select Type and Group.
3. Enter name, email, roll number.
4. Click **Add**.

#### Add Participants — Email Invite

1. Click **Add Participants** → **Invite** tab.
2. Select Type and Group.
3. Enter the student's email.
4. Click **Send Invite**. They receive an email with a link to register themselves.

#### Generate a Reusable Invite Link

1. On the Type or Group page, click **Generate Invite Link**.
2. Copy the link and share via WhatsApp, email, etc.
3. Students open the link, fill their details, and are automatically added to the correct group.
4. The same link can be used by many students.

> **Important:** The Type/Group is set by the host when creating the link. Students cannot change which group they're joining.

---

### GUIDE 4: Creating a Quiz Session

1. Click **Sessions** → **New Session**.
2. Enter a **title** (e.g., "Chapter 5 Test").
3. Select the **category and topic** your questions are in.
4. Configure the quiz:
   - Number of questions (e.g., 10, or "Use All")
   - Question types (MCQ only, mixed, etc.)
   - Time per question (e.g., 30 seconds — leave blank for no limit)
   - Toggle **Show results after quiz** if students should see their scores immediately
5. Choose **participant mode**:
   - **Public** — Anyone with the code can join. Good for open quizzes.
   - **Closed roster** — Only your pre-registered participants can join. Select the groups.
6. Optionally enable **Schedule for Later** and pick a date/time.
7. Click **Create Session**.

After creation you'll see a **6-digit code** and **QR code** to share with participants.

---

### GUIDE 5: Running a Live Quiz

#### Before Starting
1. Open the session — you're in the **Lobby**.
2. Share the code or QR code.
3. Participants' names appear in real time as they join.

#### During the Quiz
1. Click **Start Quiz** when ready.
2. All participants see Question 1 at the same time.
3. The timer counts down per question.
4. You see a live counter: "X/Y students answered."
5. Check the **Leaderboard** tab for live rankings.
6. The **Activity Panel** logs every join and answer.

#### Ending
1. After the last question, click **End Quiz**.
2. Results appear immediately — scores, rankings, pass/fail.

---

### GUIDE 6: Grading Answers

Only needed when your quiz has Short Answer or Long Answer questions.

#### Manual Grading
1. Click **Grade Answers** on the results page.
2. Select **Manual Grading**.
3. For each answer: enter a score, optionally write feedback, click **Save Grade**.
4. When all done, click **Finalize**.

#### AI Grading *(Individual Pro & Enterprise)*
1. Click **Grade Answers** → **AI Grading**.
2. Enter a rubric — describe what a good answer looks like.
3. Choose tone (Strict / Balanced / Lenient).
4. Click **Start AI Grading**.
5. Review AI scores. Edit any you disagree with.
6. Click **Finalize Grades**.

**Credit costs:** 1 credit per 10 short answers, 3 credits per 10 long answers.

---

### GUIDE 7: Viewing Reports

1. Click **Reports** in the sidebar.
2. Select a completed session.
3. Three views:
   - **Summary** — Average score, pass rate, total time.
   - **Question Analysis** — Which questions were hardest/easiest.
   - **Student Reports** — Click any participant for their full answer sheet.
4. Click **Export CSV** to download a spreadsheet.

---

### GUIDE 8: Understanding Plans & Credits

#### Plans

| Plan | Who It's For | Monthly Cost |
|------|-------------|-------------|
| Individual Free | Getting started — 3 quizzes/day, 100 questions | Free |
| Individual Pro | Serious educators — unlimited quizzes, AI features | PKR 999/month |
| Enterprise Trial | Organisations — 15-day trial, up to 2 hosts | Free |
| Enterprise Free | After trial expires — same limits as free, keeps 3 hosts | Free |
| Enterprise Pro | Large organisations — unlimited everything | PKR 7,999/month |

#### Credits

Credits are used for AI features. Every AI operation costs credits:
- Generate 10 MCQ questions = 10 credits
- Generate 10 Mixed questions = 6 credits *(best value for variety)*
- Grade 10 short answers with AI = 1 credit
- OCR scan one image = 2 credits

#### Check Balance & Upgrade
1. Click **Billing** in the sidebar.
2. See your current plan, credit balance, and transaction history.
3. Click **Upgrade Plan** to upgrade, or **Buy Credits** to top up.

#### Credit Packages

| Package | Credits | Price |
|---------|---------|-------|
| Starter | 50 | PKR 149 |
| Value | 150 | PKR 399 |
| Power | 500 | PKR 1,199 |

---

### GUIDE 9: Setting Up an Organisation (Enterprise)

#### First-Time Setup
1. After signing up as Enterprise, go to **Org** in the sidebar.
2. The onboarding wizard opens automatically.
3. Enter your company name, type (University/School/Corporate), address, phone.
4. Upload your logo.
5. Click **Complete Setup**.

#### Inviting Teachers/Hosts
1. **Org** → **Team** tab → **Invite Member**.
2. Enter their email, select role (Host), enter department.
3. Click **Send Invite**. They receive an email with instructions.
4. Once they accept, they appear as "Active" in your team.

#### Allocating Credits
1. **Org** → **Team** tab → **Transfer Credits** next to a host.
2. Enter amount and confirm.

#### Approving Credit Requests
1. When a host needs more credits, they submit a request.
2. You receive a notification.
3. **Org** → **Credits** → **Requests** tab → **Approve** or **Decline**.

---

### GUIDE 10: For Participants — How to Take a Quiz

1. Your teacher will share a **6-digit code** or a **link**.
2. Go to the quiz link or enter the code on the platform.
3. Fill in your details (name, email, roll number if required).
4. Click **Join** and wait in the lobby.
5. When the teacher starts, questions appear one by one.
6. Select or type your answer before the timer runs out.
7. After all questions: "Quiz submitted!"
8. If your teacher enabled results, your score appears immediately.

---

### GUIDE 11: Reviews & Feedback

1. Click **Reviews** in the sidebar.
2. **App Reviews** — Rate the platform (1–5 stars) and leave a comment.
3. **Feedback** — Suggest new features or report issues.
4. **Performance** — Tell us if the platform was slow during your quiz.

---

### GUIDE 12: Getting Help

| Need | Where to Go |
|------|------------|
| Update your name, photo, language | Settings → Profile |
| Check or upgrade your plan | Billing |
| See quiz results | Reports |
| Manage team (Enterprise) | Org |
| Change password | Login page → Forgot Password |
| Contact support | Use email on the platform footer with your account email and issue description |

---

*End of EvaluTease Suite — UAT Document v2.0*  
*Document covers 109 test cases across 15 modules plus 12 user guides.*  
*For corrections or additions, contact the development team.*
