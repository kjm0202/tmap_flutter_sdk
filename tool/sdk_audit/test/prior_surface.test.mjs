import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import { readPinnedPrior } from "../prior_surface.mjs";

test("prior_surface assertions", async (t) => {
  const productionUrl = new URL(
    "../baselines/production-2026-11-19-46fa62a7bb27.json",
    import.meta.url,
  );
  const previousUrl = new URL(
    "../baselines/previous-surface.json.gz",
    import.meta.url,
  );
  const manifest = JSON.parse(await fs.readFile(productionUrl, "utf8"));

  // Assertions for rejects
  await t.test("rejects for no against", async () => {
    await assert.rejects(readPinnedPrior(manifest, null));
  });

  await t.test("rejects for wrong current id", async () => {
    await assert.rejects(readPinnedPrior({ id: "wrong-id" }, previousUrl));
  });

  await t.test("rejects for missing existing path", async () => {
    await assert.rejects(readPinnedPrior(manifest, "/non/existent/path"));
  });

  await t.test("rejects for bad createdAt", async () => {
    const badManifest = { ...manifest, createdAt: "bad" };
    await assert.rejects(readPinnedPrior(badManifest, previousUrl));
  });

  // Test successful loading and row count assertion
  await t.test("reads at least 600 real projected rows", async () => {
    const prior = await readPinnedPrior(manifest, previousUrl);
    assert.ok(
      prior.rows.length >= 600,
      `Expected at least 600 rows, got ${prior.rows.length}`,
    );
  });
});
