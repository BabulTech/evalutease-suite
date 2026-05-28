export type PaymentAccount = {
  id: string;
  method: string;
  title: string;
  account_name: string;
  account_number: string;
  instructions: string | null;
  is_active: boolean;
};

export type PaymentHistory = {
  id: string;
  amount_pkr: number;
  payment_method: string;
  status: string;
  credits_to_add: number;
  created_at: string;
  reviewed_at: string | null;
};

export type CreditTx = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  price_pkr: number;
  badge_text: string | null;
  sort_order: number;
};

export type BillingStep = "overview" | "pick" | "pay" | "upload" | "done";
export type PickMode = "pack" | "plan";
export type BillingCycle = "monthly" | "yearly";

export function cyclePrice(monthlyPkr: number, cycle: BillingCycle, discountPct: number): number {
  if (cycle === "monthly") return monthlyPkr;
  const full = monthlyPkr * 12;
  return Math.max(0, Math.round(full * (1 - discountPct / 100)));
}
