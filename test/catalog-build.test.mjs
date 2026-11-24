import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const project = fileURLToPath(new URL("../", import.meta.url));
const run = promisify(execFile);

test("a new catalog snapshot builds safe metadata, Spotify links and public pages", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "catalog-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ["src", "astro.config.mjs", "package.json", "tsconfig.json"]) {
    await cp(join(project, path), join(root, path), { recursive: true });
  }
  await symlink(join(project, "node_modules"), join(root, "node_modules"), "dir");
  const dataDir = join(root, "public/data");
  await mkdir(dataDir, { recursive: true });
  const spotifyId = "aB12345678901234567890";
  const title = "Studio <edit> & reprise";
  const artist = "Guest <artist>";
  const unrelated = "https://example.invalid/unrelated";
  const song = { id: "one", title, artist, role: "Mixing", spotifyId, spotifyUrl: unrelated };
  const unlinked = { ...song, id: "two", title: "Unlinked song", spotifyId: "invalid", spotifyURL: unrelated };
  await writeFile(join(dataDir, "works.json"), JSON.stringify({ items: [song, unlinked] }));
  await run(process.execPath, [join(project, "node_modules/astro/bin/astro.mjs"), "build"], {
    cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
  });

  const output = join(root, "dist");
  const html = (path) => readFile(join(output, path), "utf8");
  assert.deepEqual(await readdir(join(output, "work")), [spotifyId]);
  const detail = await html(`work/${spotifyId}/index.html`);
  const blocks = [...detail.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(blocks.length, 2);
  for (const [, json] of blocks) assert.ok(!json.includes("<"));
  const [person, recording] = blocks.map(([, json]) => JSON.parse(json));
  assert.ok(person.description.includes(title));
  assert.equal(recording.name, title);
  assert.equal(recording.byArtist[0].name, artist);
  const expected = `https://open.spotify.com/track/${spotifyId}`;
  assert.equal(recording.sameAs, expected);
  assert.ok(detail.includes(`href="${expected}"`));
  const home = await html("index.html");
  assert.ok(home.includes(expected));
  for (const page of [home, detail]) assert.ok(!page.includes(unrelated));
  assert.ok((await html("discography/index.html")).includes("Unlinked song"));
  assert.ok((await html("sitemap.xml")).includes(`/work/${spotifyId}/`));
});
