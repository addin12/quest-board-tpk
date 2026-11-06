"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { call, type Me } from "@/lib/account-api";
import { paths } from "@/lib/hrefs";
import { useSignedIn, writeSignedIn } from "@/lib/signed-in";
import { useI18n } from "./i18n-provider";

/**
 * A thin line above the masthead for a signed-in Game Master: who they are signed in as, and the way to their account (ADR-57). It is not part of the sticky
 * header, so it scrolls away with the page and the sticky parts below it keep their place. It shows only where this browser holds a note that someone is
 * signed in (src/lib/signed-in.ts), and it asks the server once per page load whether that is still true: a session that ended clears the note.
 */
export function SignedInBar() {
  const { t, lang } = useI18n();
  const who = useSignedIn();
  const signedIn = who !== null;
  // The account and admin pages already say who is signed in and have their own sign-out: the bar would only repeat them.
  const own = new RegExp(`^/${lang}/(account|admin)(/|$)`).test(usePathname());

  // The page's first-paint script marked the document so this bar's room was kept; keep that mark true (a sign-out removes it, the account page does not show the bar).
  useEffect(() => { document.documentElement.toggleAttribute("data-signed-in", signedIn && !own); }, [signedIn, own]);

  useEffect(() => {
    if (!signedIn || own) return; // the account page asks the server itself
    let stopped = false;
    void call<Me>("GET", "/me").then((r) => {
      if (stopped) return;
      if (r.ok) writeSignedIn(r.data.profile?.name || r.data.email);
      else if (r.status === 401 || r.status === 403) writeSignedIn(null); // the session ended; anything else (offline, a server error) keeps what was shown
    });
    return () => { stopped = true; };
  }, [signedIn, own]);

  if (!who || own) return null;
  return (
    <div className="border-b border-rule bg-paper-2" data-testid="signed-in-bar">
      <div className="wrap flex items-center justify-between gap-x-[var(--space-lg)] gap-y-[var(--space-2xs)] text-sm">
        <p className="min-w-0 truncate text-ink-2">{t("nav.signedInAs", { name: who })}</p>
        <Link href={paths.account(lang)} className="link-spot inline-flex min-h-11 shrink-0 items-center font-medium">{t("footer.account")}</Link>
      </div>
    </div>
  );
}
