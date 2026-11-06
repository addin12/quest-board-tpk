"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EMPTY_FILTERS, applyFilters, filtersToQuery, gameViewsOf, type Filters, type GameView } from "@/lib/games";
import { paths } from "@/lib/hrefs";
import type { MsgKey } from "@/lib/i18n/core";
import { Choice } from "./choices";
import { useI18n } from "./i18n-provider";
import { GameRow } from "./ui";
import type { CoverRef } from "./live-pages";
import { useLive } from "./use-live";

/** One question: the words, and each answer's words with the filter it stands for ("" = no filter, the answer that leaves the question out). */
type Question = { id: "played" | "story" | "style" | "where" | "format"; q: MsgKey; answers: { value: string; label: MsgKey }[] };

const QUESTIONS: Question[] = [
  { id: "played", q: "quiz.q.played", answers: [{ value: "new", label: "quiz.a.new" }, { value: "any", label: "quiz.a.played" }] },
  {
    id: "story", q: "quiz.q.story",
    answers: [
      { value: "horror", label: "quiz.a.horror" }, { value: "fantasy", label: "quiz.a.fantasy" }, { value: "mystery", label: "quiz.a.mystery" }, { value: "sci-fi", label: "quiz.a.scifi" },
      { value: "comedy", label: "quiz.a.comedy" }, { value: "cozy", label: "quiz.a.cozy" }, { value: "any", label: "quiz.a.surprise" },
    ],
  },
  { id: "style", q: "quiz.q.style", answers: [{ value: "roleplay-heavy", label: "quiz.a.roleplay" }, { value: "combat-heavy", label: "quiz.a.combat" }, { value: "any", label: "quiz.a.both" }] },
  { id: "where", q: "quiz.q.where", answers: [{ value: "online", label: "quiz.a.online" }, { value: "in_person", label: "quiz.a.inPerson" }, { value: "any", label: "quiz.a.either" }] },
  { id: "format", q: "quiz.q.format", answers: [{ value: "one_shot", label: "quiz.a.oneShot" }, { value: "campaign", label: "quiz.a.campaign" }, { value: "any", label: "quiz.a.either" }] },
];

/** How many matches are shown on the page; the link goes on to all of them. */
const SHOWN = 3;

/** The answers as the games list's filters ("any" leaves a question out; someone new to the hobby gets the beginner-friendly games). */
export function filtersOf(answers: Record<Question["id"], string>): Filters {
  const pick = (id: Question["id"]) => (answers[id] === "any" ? "" : answers[id]);
  return {
    ...EMPTY_FILTERS,
    level: answers.played === "new" ? "beginner" : "",
    genre: pick("story"), style: pick("style"),
    where: pick("where") as Filters["where"], format: pick("format") as Filters["format"],
  };
}

/**
 * "Which game should I try?" (ADR-56): five questions on one page, no wrong answers, and under them the listed games that fit, following the live data.
 * Every question starts on its open answer, so the page opens with something to read; each answer narrows the list at once. The link goes on to the
 * games list with the same answers as filters.
 */
export function Quiz({ games, covers }: { games: GameView[]; covers: CoverRef[] }) {
  const { t, lang } = useI18n();
  const live = useLive({ games: covers });
  const all = useMemo(() => (live ? gameViewsOf(live) : games), [live, games]);
  const [answers, setAnswers] = useState<Record<Question["id"], string>>({ played: "new", story: "any", style: "any", where: "any", format: "any" });
  const filters = filtersOf(answers);
  const matches = useMemo(() => applyFilters(all, filtersOf(answers)), [all, answers]);
  const href = paths.games(lang, filtersToQuery(filters));

  return (
    <div className="grid gap-x-[var(--space-2xl)] gap-y-[var(--space-xl)] lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <form onSubmit={(e) => e.preventDefault()} className="grid min-w-0 content-start gap-[var(--space-xl)]" data-testid="quiz-form">
        {QUESTIONS.map((q) => (
          <Choice key={q.id} name={q.id} legend={t(q.q)} value={answers[q.id]} onChange={(v) => setAnswers((old) => ({ ...old, [q.id]: v }))} options={q.answers.map((a) => ({ value: a.value, label: t(a.label) }))} />
        ))}
      </form>

      <section aria-labelledby="quiz-result-h" className="min-w-0 lg:sticky lg:top-24 lg:self-start" data-testid="quiz-result">
        <h2 id="quiz-result-h" className="text-[length:var(--text-title)]">{t("quiz.result")}</h2>
        <p className="mt-[var(--space-xs)] text-ink-2" role="status" data-testid="quiz-count">
          {matches.length === 0 ? t("quiz.none") : t("quiz.count", { n: matches.length })}
        </p>
        {matches.length > 0 && (
          <ul className="ruled mt-[var(--space-sm)] border-t-3" data-testid="quiz-matches">
            {matches.slice(0, SHOWN).map((g) => <li key={g.id}><GameRow game={g} t={t} lang={lang} /></li>)}
          </ul>
        )}
        <p className="mt-[var(--space-lg)]">
          <Link href={href} className="btn btn-primary" data-testid="quiz-see">{matches.length > 0 ? t("quiz.see", { n: matches.length }) : t("quiz.seeAll")}</Link>
        </p>
      </section>
    </div>
  );
}
