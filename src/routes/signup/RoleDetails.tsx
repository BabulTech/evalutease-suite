import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipButton } from "./-components";
import { GRADE_YEARS, INDUSTRIES, TEAM_SIZES } from "./constants";
import type { SignupFormData } from "./-schema";

type FormState = SignupFormData & { useCases: string[] };
type SetForm = React.Dispatch<React.SetStateAction<FormState>>;

interface RoleDetailsProps {
  role: string;
  form: FormState;
  setForm: SetForm;
}

export function StudentDetails({ form, setForm }: Omit<RoleDetailsProps, "role">) {
  return (
    <div className="space-y-3 p-4 rounded-2xl bg-primary/5 border border-primary/15">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide">Student Details</p>
      <div>
        <Label className="mb-1.5 text-xs">School / University</Label>
        <Input
          value={form.school ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
          placeholder="University of Karachi"
          className="h-12 text-base"
          autoComplete="organization"
        />
      </div>
      <div>
        <Label className="mb-2 text-xs block">Grade / Year</Label>
        <div className="flex flex-wrap gap-2">
          {GRADE_YEARS.map((g) => (
            <ChipButton
              key={g}
              active={form.gradeYear === g}
              onClick={() => setForm((f) => ({ ...f, gradeYear: g }))}
            >
              {g}
            </ChipButton>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-1.5 text-xs">Field of Study</Label>
        <Input
          value={form.fieldOfStudy ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, fieldOfStudy: e.target.value }))}
          placeholder="e.g. Computer Science"
          className="h-12 text-base"
        />
      </div>
    </div>
  );
}

export function TeacherDetails({ form, setForm }: Omit<RoleDetailsProps, "role">) {
  return (
    <div className="space-y-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15">
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Teacher Details</p>
      <div>
        <Label className="mb-1.5 text-xs">Institution / School Name</Label>
        <Input
          value={form.institution ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
          placeholder="Beaconhouse School"
          className="h-12 text-base"
          autoComplete="organization"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-xs">Subject Taught</Label>
          <Input
            value={form.subjectTaught ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, subjectTaught: e.target.value }))}
            placeholder="Mathematics"
            className="h-12 text-base"
          />
        </div>
        <div>
          <Label className="mb-1.5 text-xs">Years of Experience</Label>
          <Input
            value={form.yearsExp ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, yearsExp: e.target.value }))}
            type="number"
            inputMode="numeric"
            min="0"
            max="50"
            placeholder="5"
            className="h-12 text-base"
          />
        </div>
      </div>
    </div>
  );
}

export function EmployerDetails({ form, setForm }: Omit<RoleDetailsProps, "role">) {
  return (
    <div className="space-y-3 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/15">
      <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">
        Employer Details
      </p>
      <div>
        <Label className="mb-1.5 text-xs">Company Name</Label>
        <Input
          value={form.companyName ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
          placeholder="Acme Corp"
          className="h-12 text-base"
          autoComplete="organization"
        />
      </div>
      <div>
        <Label className="mb-2 text-xs block">Industry</Label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((ind) => (
            <ChipButton
              key={ind}
              active={form.industry === ind}
              onClick={() => setForm((f) => ({ ...f, industry: ind }))}
            >
              {ind}
            </ChipButton>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-2 text-xs block">Team Size</Label>
        <div className="flex flex-wrap gap-2">
          {TEAM_SIZES.map((sz) => (
            <ChipButton
              key={sz}
              active={form.teamSize === sz}
              onClick={() => setForm((f) => ({ ...f, teamSize: sz }))}
            >
              {sz}
            </ChipButton>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OtherDetails({ form, setForm }: Omit<RoleDetailsProps, "role">) {
  return (
    <div className="space-y-2 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15">
      <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide">Other Details</p>
      <textarea
        value={form.otherDetails ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, otherDetails: e.target.value }))}
        rows={3}
        aria-label="Describe how you plan to use EvaluTease"
        placeholder="Describe how you plan to use EvaluTease..."
        className="w-full rounded-xl border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
      />
    </div>
  );
}

export function RoleDetails({ role, form, setForm }: RoleDetailsProps) {
  if (role === "Student") return <StudentDetails form={form} setForm={setForm} />;
  if (role === "Teacher") return <TeacherDetails form={form} setForm={setForm} />;
  if (role === "Employer") return <EmployerDetails form={form} setForm={setForm} />;
  if (role === "Other") return <OtherDetails form={form} setForm={setForm} />;
  return null;
}
