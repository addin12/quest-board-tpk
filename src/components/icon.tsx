import type { IconName } from "@/lib/icons";
import { ICON_MARKUP } from "./icon-data";

type IconProps = { name: IconName; className?: string; label?: string };

/**
 * A Phosphor outline (see `npm run icons`), drawn inline in the current text colour at 1em.
 * Decorative by default; pass `label` when the icon carries meaning on its own.
 * The markup is a constant generated from the icon package, never user input.
 */
export function Icon({ name, className = "", label }: IconProps) {
  return (
    <svg
      viewBox="0 0 256 256"
      width="1em"
      height="1em"
      fill="currentColor"
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: ICON_MARKUP[name] }}
    />
  );
}
