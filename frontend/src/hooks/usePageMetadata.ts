import { useEffect } from "react";

interface PageMetadata {
  title: string;
  description: string;
  path: string;
  robots?: string;
  image?: string;
}

// The origin the app is actually served from, so canonical and share URLs
// follow the deployment instead of a hardcoded domain.
const SITE_ORIGIN = window.location.origin;

function ensureMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !element;
  if (!element) {
    element = document.createElement("meta");
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    element.setAttribute("data-page-metadata", "true");
    document.head.appendChild(element);
  }
  return { element, created, previous: element.content };
}

/** Keeps SPA page, canonical, Open Graph, Twitter, and robots metadata in sync. */
export function usePageMetadata({
  title,
  description,
  path,
  robots = "index, follow",
  image = `${SITE_ORIGIN}/og-image.png`,
}: PageMetadata) {
  useEffect(() => {
    const previousTitle = document.title;
    const url = `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
    const metadata = [
      ensureMeta('meta[name="description"]', { name: "description" }),
      ensureMeta('meta[name="robots"]', { name: "robots" }),
      ensureMeta('meta[property="og:type"]', { property: "og:type" }),
      ensureMeta('meta[property="og:title"]', { property: "og:title" }),
      ensureMeta('meta[property="og:description"]', { property: "og:description" }),
      ensureMeta('meta[property="og:url"]', { property: "og:url" }),
      ensureMeta('meta[property="og:image"]', { property: "og:image" }),
      ensureMeta('meta[name="twitter:card"]', { name: "twitter:card" }),
      ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" }),
      ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" }),
      ensureMeta('meta[name="twitter:image"]', { name: "twitter:image" }),
    ];
    const values = [
      description,
      robots,
      "website",
      title,
      description,
      url,
      image,
      "summary_large_image",
      title,
      description,
      image,
    ];
    document.title = title;
    metadata.forEach(({ element }, index) => { element.content = values[index]; });

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const canonicalCreated = !canonical;
    const previousCanonical = canonical?.href || "";
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.setAttribute("data-page-metadata", "true");
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    return () => {
      document.title = previousTitle;
      metadata.forEach(({ element, created, previous }) => {
        if (created) element.remove();
        else element.content = previous;
      });
      if (canonicalCreated) canonical?.remove();
      else if (canonical) canonical.href = previousCanonical;
    };
  }, [description, image, path, robots, title]);
}
