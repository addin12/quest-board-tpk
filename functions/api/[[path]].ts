// Cloudflare Pages Function: every /api/* request. All the logic is in worker/src; this only wires up the bindings
// (see docs/setup.md): DB (D1), IMAGES (R2) and the variables below.
import { handle } from "../../worker/src/handler.ts";
import type { Bucket, Db } from "../../worker/src/db.ts";
import { resendMailer, type Mailer } from "../../worker/src/email.ts";

type Bindings = {
  DB: Db;
  IMAGES: Bucket;
  SITE_URL: string;
  OWNER_EMAIL: string;
  BUILD_KEY: string;
  DEPLOY_HOOK: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  TURNSTILE_SECRET: string;
};

/** Without a mail key (a preview or a local run) the sign-in links are not sent anywhere: nobody can sign in, which is the safe failure. */
const silent: Mailer = { send: async () => { throw new Error("mail_not_configured"); } };

export const onRequest = async ({ request, env, waitUntil }: { request: Request; env: Bindings; waitUntil: (p: Promise<unknown>) => void }): Promise<Response> =>
  handle(
    request,
    {
      ctx: {
        db: env.DB,
        mailer: env.RESEND_API_KEY && env.MAIL_FROM ? resendMailer(env.RESEND_API_KEY, env.MAIL_FROM) : silent,
        now: Date.now,
        siteUrl: env.SITE_URL.replace(/\/$/, ""),
        owner: env.OWNER_EMAIL.trim().toLowerCase(),
      },
      images: env.IMAGES,
      buildKey: env.BUILD_KEY,
      deployHook: env.DEPLOY_HOOK,
      turnstileSecret: env.TURNSTILE_SECRET,
    },
    waitUntil,
  );
