import type { Metadata } from "next";
import { ListingView } from "@/components/listing-view";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** A listing that went live after the last build, shown from the live data (see components/listing-view.tsx). */
export default function ViewPage() {
  return <ListingView />;
}
