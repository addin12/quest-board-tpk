"use client";

import Image from "next/image";
import { useState } from "react";

/** An image that removes itself if it can't be loaded, so the colour behind it shows instead of a broken-image icon. */
export function Picture({ src, sizes, priority = false, className = "object-cover" }: { src: string; sizes: string; priority?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <Image src={src} alt="" fill sizes={sizes} priority={priority} className={className} onError={() => setFailed(true)} />;
}
