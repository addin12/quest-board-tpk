import type { MouseEvent } from "react";

/**
 * True when a click on a modal dialog landed on its backdrop, outside the box: the click's target is the dialog itself for the backdrop and for
 * the dialog's own padding, so the position decides.
 */
export function clickedBackdrop(e: MouseEvent<HTMLDialogElement>): boolean {
  const box = e.currentTarget.getBoundingClientRect();
  return e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
}
