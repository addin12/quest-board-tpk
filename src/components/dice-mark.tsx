/** A d20 drawn as an outline: the mark beside the wordmark, in the current text colour. Decorative; the link beside it carries the name. */
export function DiceMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
      <path d="M12 6.5 17.5 16h-11z" />
      <path d="M12 2v4.5M3 7l9 4.5L21 7M3 17l3.5-1M21 17l-3.5-1M12 22v-6" />
    </svg>
  );
}
