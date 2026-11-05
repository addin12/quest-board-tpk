"use client";

import { useState } from "react";
import { openWhatsApp } from "@/lib/contact";
import type { MsgKey } from "@/lib/i18n/core";

/** The tap on a WhatsApp button: asks for the number, opens the chat, and says in words (a message key) when it could not. */
export function useWhatsApp(gmId: string, message: string) {
  const [problem, setProblem] = useState<MsgKey | null>(null);
  const [busy, setBusy] = useState(false);
  async function open() {
    setProblem(null);
    setBusy(true);
    const answer = await openWhatsApp(gmId, message);
    setBusy(false);
    if (!answer.ok) setProblem(answer.reason === "busy" ? "game.contactBusy" : "game.contactFailed");
  }
  return { open, problem, busy };
}
