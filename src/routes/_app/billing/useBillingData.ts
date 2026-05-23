import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentAccount, PaymentHistory, CreditTx, CreditPackage } from "./types";

export function useBillingData(userId: string | undefined) {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [creditTx, setCreditTx] = useState<CreditTx[]>([]);
  const [creditPacks, setCreditPacks] = useState<CreditPackage[]>([]);

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    supabase
      .from("payment_accounts")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setAccounts(data as PaymentAccount[]);
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("credit_packages")
      .select("id,name,credits,price_pkr,badge_text,sort_order")
      .eq("is_active", true)
      .order("sort_order")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data) setCreditPacks(data as CreditPackage[]);
      });

    if (!userId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("manual_payments")
      .select("id,amount_pkr,payment_method,status,credits_to_add,created_at,reviewed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data) setHistory(data as PaymentHistory[]);
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("credit_transactions")
      .select("id,type,amount,description,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data) setCreditTx(data as CreditTx[]);
      });
  }, [userId]);

  return { accounts, history, creditTx, creditPacks };
}
