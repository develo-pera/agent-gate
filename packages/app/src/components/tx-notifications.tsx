"use client";

import { useTxNotifications } from "@/lib/hooks/use-tx-notifications";

export function TxNotifications() {
  useTxNotifications();
  return null;
}
