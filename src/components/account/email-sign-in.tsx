"use client";

import { useEffect, useRef, useState } from "react";
import { call } from "@/lib/account-api";
import { TURNSTILE_SITE_KEY } from "@/lib/site";
import { useI18n } from "../i18n-provider";
import { Field, errorText } from "./fields";

type Turnstile = { render(el: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void }): string; reset(id?: string): void };

let loading: Promise<Turnstile> | null = null;
/** Cloudflare's robot check script, loaded once (only when the site has a key for it). */
function loadTurnstile(): Promise<Turnstile> {
  const w = window as unknown as { turnstile?: Turnstile };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => { loading = null; reject(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Asks for an email address and sends the one-time sign-in link. Used by the account page and the admin page. */
export function EmailSignIn({ heading, lead }: { heading: string; lead: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string>("");

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let live = true;
    loadTurnstile().then((ts) => {
      if (live && box.current && !widget.current) widget.current = ts.render(box.current, { sitekey: TURNSTILE_SITE_KEY, callback: setToken, "expired-callback": () => setToken("") });
    }).catch(() => setProblem(errorText(t, "turnstile_failed")));
    return () => { live = false; };
  }, [t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem("");
    const r = await call("POST", "/login/request", { email, turnstile: token });
    setBusy(false);
    if (r.ok) setSentTo(email.trim());
    else {
      setProblem(errorText(t, r.error));
      const ts = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (ts && widget.current) { ts.reset(widget.current); setToken(""); }
    }
  }

  if (sentTo) {
    return (
      <div className="max-w-xl" role="status" data-testid="link-sent">
        <h2 className="text-[length:var(--text-section)]">{t("acct.sentTitle")}</h2>
        <p className="lead mt-[var(--space-md)]">{t("acct.sentBody", { email: sentTo })}</p>
        <p className="mt-[var(--space-lg)]"><button type="button" className="btn btn-secondary" onClick={() => setSentTo("")}>{t("acct.sentAgain")}</button></p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="max-w-xl" data-testid="sign-in-form">
      <h2 className="text-[length:var(--text-section)]">{heading}</h2>
      <p className="lead mt-[var(--space-md)]">{lead}</p>
      <div className="mt-[var(--space-xl)]">
        <Field id="si-email" label={t("acct.emailLabel")} hint={t("acct.emailHint")}>
          <input id="si-email" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      {TURNSTILE_SITE_KEY && <div ref={box} className="mt-[var(--space-md)]" aria-label={t("robot.label")} />}
      {problem && <p role="alert" className="mt-[var(--space-md)] font-bold text-danger">{problem}</p>}
      <p className="mt-[var(--space-lg)]"><button type="submit" className="btn btn-primary" disabled={busy || (Boolean(TURNSTILE_SITE_KEY) && !token)}>{busy ? t("acct.sending") : t("acct.sendLink")}</button></p>
    </form>
  );
}
