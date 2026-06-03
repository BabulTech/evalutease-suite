import { z } from "zod";
import { passwordSchema } from "./constants";

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(60),
  lastName: z.string().trim().min(1, "Last name required").max(60),
  mobile: z.string().trim().min(7, "Mobile number is required").max(30),
  email: z.string().trim().email("Invalid email").max(255),
  password: passwordSchema,
  role: z.string().min(1, "Please select your role"),
  useCases: z.array(z.string()).min(1, "Select at least one use case"),
  referral: z.string().min(1, "Please select how you heard about us"),
  school: z.string().trim().max(120).optional(),
  gradeYear: z.string().trim().max(60).optional(),
  fieldOfStudy: z.string().trim().max(120).optional(),
  institution: z.string().trim().max(120).optional(),
  subjectTaught: z.string().trim().max(120).optional(),
  yearsExp: z.string().trim().max(10).optional(),
  companyName: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(120).optional(),
  teamSize: z.string().trim().max(20).optional(),
  otherDetails: z.string().trim().max(300).optional(),
  department: z.string().trim().max(120).optional(),
  enterpriseType: z.string().trim().max(40).optional(),
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type FieldErrors = Partial<Record<string, string>>;

export const initialForm: SignupFormData & { useCases: string[] } = {
  firstName: "",
  lastName: "",
  mobile: "",
  email: "",
  password: "",
  role: "",
  useCases: [],
  referral: "",
  school: "",
  gradeYear: "",
  fieldOfStudy: "",
  institution: "",
  subjectTaught: "",
  yearsExp: "",
  companyName: "",
  industry: "",
  teamSize: "",
  otherDetails: "",
  department: "",
  enterpriseType: "",
};
