import { jsonLdString } from "@/lib/seo";

/** Structured data for search engines (lib/seo.ts builders). Rendered into the page; never executed. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
