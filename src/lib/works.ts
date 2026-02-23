import fs from "node:fs/promises";

export type WorkItem = {
  id: string;
  artist: string;
  title: string;
  role?: string;
  label?: string;
  streams?: number;
  artworkUrl?: string;
  previewUrl?: string;
  spotifyId?: string;
  spotifyUrl?: string;
};

type WorksJson = {
  generatedAt?: string;
  count?: number;
  items?: unknown;
};

const worksJsonUrl = new URL("../../public/data/works.json", import.meta.url);

const asNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export async function loadWorks(): Promise<WorkItem[]> {
  const raw = await fs.readFile(worksJsonUrl, "utf8");
  const parsed = JSON.parse(raw) as WorksJson;
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;

      const id = asNonEmptyString(record.id);
      const artist = asNonEmptyString(record.artist);
      const title = asNonEmptyString(record.title);
      if (!id || !artist || !title) return null;

      const spotifyUrl = asNonEmptyString(record.spotifyUrl ?? record.spotifyURL);

      return {
        id,
        artist,
        title,
        role: asNonEmptyString(record.role),
        label: asNonEmptyString(record.label),
        streams: asNumber(record.streams),
        artworkUrl: asNonEmptyString(record.artworkUrl),
        previewUrl: asNonEmptyString(record.previewUrl),
        spotifyId: asNonEmptyString(record.spotifyId),
        spotifyUrl,
      } satisfies WorkItem;
    })
    .filter((item): item is WorkItem => Boolean(item));
}

export function uniqueSpotifyWorks(items: WorkItem[]): WorkItem[] {
  const seen = new Set<string>();
  const result: WorkItem[] = [];
  for (const item of items) {
    if (!item.spotifyId) continue;
    if (seen.has(item.spotifyId)) continue;
    seen.add(item.spotifyId);
    result.push(item);
  }
  return result;
}

export function workPath(spotifyId: string): string {
  return `/work/${encodeURIComponent(spotifyId)}/`;
}
