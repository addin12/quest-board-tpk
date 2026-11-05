"use client";

import { useState } from "react";
import { useI18n } from "./i18n-provider";

/**
 * "Report this listing": a visitor says what is wrong (optional) and it goes to the backend (POST /api/report). Three different people reporting a listing
 * hide it until an admin has looked, so there is no review in front of a listing, only this and the admin's own eyes after it.
 */
export function ReportButton({ kind, id }: { kind: "game" | "gm"; id: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, reason }) });
      setState(res.ok ? "done" : "failed");
    } catch {
      setState("failed");
    }
  }

  if (state === "done") return <p role="status" className="mt-[var(--space-sm)] text-sm font-medium" data-testid="report-done">{t("game.reportThanks")}</p>;
  if (!open) {
    return (
      <p className="mt-[var(--space-sm)]">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className="inline-flex min-h-11 items-center text-sm font-medium underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-deep" data-testid="report-open">{t("game.report")}</button>
      </p>
    );
  }
  return (
    <form onSubmit={send} className="mt-[var(--space-sm)] grid gap-[var(--space-sm)]" data-testid="report-form">
      <label htmlFor={`report-${id}`} className="text-sm font-medium">{t("game.reportLabel")}</label>
      <p className="text-sm text-ink-2">{t("game.reportBody")}</p>
      <textarea id={`report-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} className="input min-h-24" />
      {state === "failed" && <p role="alert" className="text-sm font-medium text-danger">{t("game.reportFailed")}</p>}
      <div className="flex flex-wrap gap-[var(--space-sm)]">
        <button type="submit" className="btn btn-primary" disabled={state === "sending"}>{t("game.reportSend")}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>{t("game.reportCancel")}</button>
      </div>
    </form>
  );
}
