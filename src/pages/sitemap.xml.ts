import fs from "node:fs/promises";
import { loadWorks, uniqueSpotifyWorks, workPath } from "../lib/works";

const worksJsonUrl = new URL("../../public/data/works.json", import.meta.url);

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toIsoDate = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return undefined;
  return date.toISOString();
};

export async function GET({ site }: { site: URL }) {
  const works = uniqueSpotifyWorks(await loadWorks());

  let lastmod: string | undefined;
  try {
    const raw = await fs.readFile(worksJsonUrl, "utf8");
    const parsed = JSON.parse(raw) as { generatedAt?: unknown };
    lastmod = toIsoDate(parsed.generatedAt);
  } catch {
    // Optional.
  }

  const urls = [
    new URL("/", site).href,
    new URL("/discography/", site).href,
    ...works.map((work) => new URL(workPath(work.spotifyId!), site).href),
  ];

  const urlEntries = urls
    .map((href) => {
      const lastmodTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `  <url>\n    <loc>${escapeXml(href)}</loc>${lastmodTag}\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

