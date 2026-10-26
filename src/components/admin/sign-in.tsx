"use client";

import { useEffect, useRef, useState } from "react";
import { renderSignIn } from "@/lib/admin-api";
import { useI18n } from "../i18n-provider";
import { Notice } from "../ui";

/** Google's "Sign in" button with a short explanation. `onToken` receives the ID token once someone signs in. */
export function SignIn({ expired, onToken }: { expired: boolean; onToken: (token: string) => void }) {
  const { t, lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (box.current) renderSignIn(box.current, lang, onToken).catch(() => setFailed(true));
  }, [lang, onToken]);

  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <h2 className="text-2xl font-bold">{t("admin.signInTitle")}</h2>
      <p className="mt-2 text-muted">{t("admin.signInBody")}</p>
      {expired && <div className="mt-4 text-left"><Notice tone="warn">{t("admin.sessionExpired")}</Notice></div>}
      <div ref={box} className="mt-6 flex min-h-11 justify-center" data-testid="google-signin" />
      {failed && <div className="mt-4 text-left"><Notice tone="danger">{t("admin.loadError", { error: "google" })}</Notice></div>}
    </div>
  );
}
