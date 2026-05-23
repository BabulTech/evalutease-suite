import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  REGISTRATION_FIELD_LABELS,
  type RegistrationFieldKey,
  type RegistrationFields,
} from "@/components/settings/host-settings";

const PLACEHOLDERS: Partial<Record<RegistrationFieldKey, string>> = {
  name: "Your full name",
  email: "you@example.com",
  mobile: "+92 300 0000000",
  roll_number: "2026-CS-042",
  seat_number: "A-12",
  class: "Class 10",
  grade: "Grade 10",
  organization: "Babul Academy",
  employee_id: "EMP-1234",
  department: "Engineering",
  address: "Street, City",
  notes: "Anything worth noting",
};

type Props = {
  fields: RegistrationFields;
  visibleKeys: RegistrationFieldKey[];
  values: Partial<Record<RegistrationFieldKey, string>>;
  onChange: (key: RegistrationFieldKey, value: string) => void;
};

export function RegistrationFields({ fields, visibleKeys, values, onChange }: Props) {
  return (
    <>
      {visibleKeys.map((key) => (
        <div key={key}>
          <Label className="mb-1.5">
            {REGISTRATION_FIELD_LABELS[key]}
            {fields[key].required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            value={values[key] ?? ""}
            onChange={(e) => onChange(key, e.target.value)}
            type={key === "email" ? "email" : key === "mobile" ? "tel" : "text"}
            placeholder={PLACEHOLDERS[key] ?? ""}
            autoComplete={
              key === "email" ? "email" : key === "name" ? "name" : key === "mobile" ? "tel" : "off"
            }
          />
        </div>
      ))}
    </>
  );
}
