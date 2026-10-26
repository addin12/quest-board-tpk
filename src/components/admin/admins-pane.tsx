"use client";

import { useState } from "react";
import type { AdminEntry } from "@/lib/types";
import { Icon } from "../icon";
import { useI18n } from "../i18n-provider";
import { Notice } from "../ui";

/** Who may review: the owner (always) and the people added here. Adding someone is one email address. */
export function AdminsPane({ admins, owner, me, onAdd, onRemove }: {
  admins: AdminEntry[];
  owner: string;
  me: string;
  onAdd: (email: string) => Promise<string | null>;
  onRemove: (email: string) => Promise<string | null>;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await onAdd(email.trim());
    setBusy(false);
    setError(err);
    if (!err) setEmail("");
  }

  return (
    <section className="mt-6 max-w-2xl" aria-labelledby="admins-h">
      <h2 id="admins-h" className="text-2xl font-bold">{t("admin.admins.title")}</h2>
      <p className="mt-1 text-muted">{t("admin.admins.lead")}</p>

      <ul className="card mt-5 divide-y divide-border" data-testid="admins-list">
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0 break-all font-semibold">{owner}</span>
          <span className="chip">{t("admin.admins.owner")}{owner === me ? ` · ${t("admin.admins.you")}` : ""}</span>
        </li>
        {admins.map((a) => (
          <li key={a.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block break-all font-semibold">{a.email}{a.email === me ? ` · ${t("admin.admins.you")}` : ""}</span>
              <span className="block text-sm text-muted">{t("admin.admins.addedBy", { email: a.addedBy })}</span>
            </span>
            {a.email !== me && (
              <button type="button" className="btn-ghost" aria-label={t("admin.admins.removeNamed", { email: a.email })} onClick={async () => setError(await onRemove(a.email))}>
                <Icon name="trash" /> {t("admin.admins.remove")}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="card mt-6 p-5">
        <h3 className="text-lg font-semibold">{t("admin.admins.addTitle")}</h3>
        <label htmlFor="new-admin" className="label mt-3">{t("admin.admins.emailLabel")}</label>
        <input id="new-admin" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" spellCheck={false} />
        <p className="hint">{t("admin.admins.emailHint")}</p>
        {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
        <p className="mt-4"><button type="submit" className="btn-primary" disabled={busy || !email.trim()}><Icon name="user-add" /> {t("admin.admins.addButton")}</button></p>
      </form>
    </section>
  );
}
