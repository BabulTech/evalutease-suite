export type CompanyProfile = {
  id?: string;
  company_name: string;
  company_type: string;
  registration_no: string;
  website: string;
  address: string;
  city: string;
  province: string;
  country: string;
  phone: string;
  email: string;
  total_students: string;
  established_year: string;
  description: string;
  onboarding_completed?: boolean;
};

export type MemberRow = {
  id: string;
  full_name: string;
  invited_email: string;
  role: string;
  department: string | null;
  designation: string | null;
  status: string;
  user_id: string | null;
  credit_limit: number;
  credits_used: number;
  balance?: number;
};

export type TxRow = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export type CreditRequestRow = {
  id: string;
  member_id: string;
  requester_user_id: string;
  amount: number;
  note: string | null;
  status: "pending" | "approved" | "declined";
  resolved_at: string | null;
  created_at: string;
  requester_name?: string;
  requester_email?: string;
};

export const COMPANY_TYPES = [
  { value: "school", label: "School" },
  { value: "university", label: "University" },
  { value: "college", label: "College" },
  { value: "training_center", label: "Training Center" },
  { value: "corporate", label: "Corporate / Company" },
  { value: "government", label: "Government / Public Sector" },
  { value: "ngo", label: "NGO / Non-profit" },
  { value: "other", label: "Other" },
];

export const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Gilgit-Baltistan",
  "Azad Kashmir",
  "Islamabad Capital Territory",
];
export const DEPARTMENTS = [
  "Science",
  "Mathematics",
  "English",
  "Urdu",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Social Studies",
  "Islamic Studies",
  "Arts",
  "Commerce",
  "Administration",
  "IT Department",
  "Other",
];
export const DESIGNATIONS = [
  "Teacher",
  "Senior Teacher",
  "Head of Department",
  "Vice Principal",
  "Principal",
  "Coordinator",
  "Lecturer",
  "Assistant Professor",
  "Professor",
  "Trainer",
  "Manager",
  "Other",
];

const TYPE_CONFIG: Record<
  string,
  {
    staffLabel: string;
    staffPlaceholder: string;
    regLabel: string;
    regPlaceholder: string;
    showWebsite: boolean;
    showEstYear: boolean;
  }
> = {
  school: {
    staffLabel: "Total Students",
    staffPlaceholder: "e.g. 500",
    regLabel: "School Reg. No.",
    regPlaceholder: "Registration number",
    showWebsite: true,
    showEstYear: true,
  },
  university: {
    staffLabel: "Total Students",
    staffPlaceholder: "e.g. 5000",
    regLabel: "HEC Reg. No.",
    regPlaceholder: "HEC reg / charter no.",
    showWebsite: true,
    showEstYear: true,
  },
  college: {
    staffLabel: "Total Students",
    staffPlaceholder: "e.g. 800",
    regLabel: "College Reg. No.",
    regPlaceholder: "Registration number",
    showWebsite: true,
    showEstYear: true,
  },
  training_center: {
    staffLabel: "Total Trainees",
    staffPlaceholder: "e.g. 200",
    regLabel: "License / Reg. No.",
    regPlaceholder: "License number",
    showWebsite: true,
    showEstYear: true,
  },
  corporate: {
    staffLabel: "Total Employees",
    staffPlaceholder: "e.g. 150",
    regLabel: "Company Reg. (SECP)",
    regPlaceholder: "SECP / NTN number",
    showWebsite: true,
    showEstYear: true,
  },
  government: {
    staffLabel: "Total Staff",
    staffPlaceholder: "e.g. 300",
    regLabel: "Dept. Code / Reference",
    regPlaceholder: "Dept. code or ID",
    showWebsite: false,
    showEstYear: false,
  },
  ngo: {
    staffLabel: "Total Members/Staff",
    staffPlaceholder: "e.g. 50",
    regLabel: "NGO Reg. No.",
    regPlaceholder: "SECP / EAD reg no.",
    showWebsite: true,
    showEstYear: true,
  },
  other: {
    staffLabel: "Total People",
    staffPlaceholder: "Approx. count",
    regLabel: "Registration No.",
    regPlaceholder: "Optional",
    showWebsite: true,
    showEstYear: true,
  },
};
export const getCfg = (t: string) => TYPE_CONFIG[t] ?? TYPE_CONFIG.other;

export const TX_LABEL: Record<string, string> = {
  plan_refill: "Monthly Refill",
  payment_approved: "Payment Approved",
  ai_question_gen: "AI Question Gen",
  ai_image_scan: "AI Image Scan",
  admin_adjustment: "Admin Adjustment",
  extra_quiz: "Extra Quiz",
  extra_participants: "Extra Participants",
  expiry: "Credits Expired",
};
