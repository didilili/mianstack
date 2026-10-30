import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createContentSchemaValidators,
  loadContentSchema,
  schemaErrors
} from "../scripts/lib/schema.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const validators = createContentSchemaValidators(loadContentSchema(root));
const publisher = {
  id: "PUB-DEMO",
  name: "Demo",
  type: "individual",
  updatedAt: "2026-10-20"
};
const errors = (fields) =>
  schemaErrors(validators.publisher, { ...publisher, ...fields }, "publisher");

test("repository metadata is optional and accepts distinct canonical GitHub project URLs", () => {
  assert.deepEqual(errors({}), []);
  assert.deepEqual(
    errors({
      githubRepositories: [
        "https://github.com/datawhalechina/daily-interview",
        "https://github.com/datawhalechina/hello-agents"
      ]
    }),
    []
  );
});

test("repository metadata rejects empty and duplicate arrays", () => {
  for (const githubRepositories of [
    [],
    ["https://github.com/owner/repo", "https://github.com/owner/repo"]
  ])
    assert.ok(errors({ githubRepositories }).length > 0);
});

test("repository URLs reject profiles, files, branches, URL extras and unsupported hosts", () => {
  for (const url of [
    "http://github.com/owner/repo",
    "https://github.com/owner/",
    "https://github.com/owner/repo/",
    "https://github.com/owner/repo/blob/main/README.md",
    "https://github.com/owner/repo/tree/main",
    "https://github.com/owner/repo?tab=readme",
    "https://github.com/owner/repo#readme",
    "https://github.com/owner/.",
    "https://github.com/owner/..",
    "https://user@github.com/owner/repo",
    "https://www.github.com/owner/repo",
    "https://github.com:443/owner/repo",
    "https://example.com/owner/repo",
    "https://github.com/owner/a repo"
  ])
    assert.ok(errors({ githubRepositories: [url] }).length > 0, url);
});

test("all known GitHub authors retain each source project and linked official repository", () => {
  const publishers = JSON.parse(fs.readFileSync(path.join(root, "publishers.json"), "utf8"));
  const byId = new Map(publishers.map((entry) => [entry.id, entry]));
  const expected = new Map(publishers.map((entry) => [entry.id, new Set()]));
  for (const filename of fs.readdirSync(path.join(root, "collections"))) {
    if (!filename.endsWith(".json")) continue;
    const collection = JSON.parse(
      fs.readFileSync(path.join(root, "collections", filename), "utf8")
    );
    const source = new URL(collection.sourceUrl);
    if (source.hostname !== "github.com") continue;
    const [owner, repository] = source.pathname.split("/").filter(Boolean);
    expected.get(collection.publisherId).add(`https://github.com/${owner}/${repository}`);
  }
  expected.get("PUB-XL").add("https://github.com/xiaolincoder/CS-Base");
  expected.get("PUB-JAVABETTER").add("https://github.com/itwanger/toBeBetterJavaer");
  expected.get("PUB-JAVABETTER").add("https://github.com/itwanger/ai-better");
  expected.get("PUB-NAGEOFFER").add("https://github.com/nageoffer/ai-handbook");

  for (const entry of publishers) {
    assert.deepEqual(new Set(entry.githubRepositories || []), expected.get(entry.id), entry.id);
    assert.equal(
      new Set((entry.githubRepositories || []).map((url) => url.toLowerCase())).size,
      entry.githubRepositories?.length || 0,
      entry.id
    );
    assert.deepEqual(schemaErrors(validators.publisher, entry, entry.id), []);
  }
  assert.deepEqual(byId.get("PUB-DATAWHALE").githubRepositories, [
    "https://github.com/datawhalechina/daily-interview",
    "https://github.com/datawhalechina/hello-agents"
  ]);
  assert.equal(Object.hasOwn(byId.get("PUB-WB"), "githubRepositories"), false);
  assert.equal(Object.hasOwn(byId.get("PUB-MYL"), "githubRepositories"), false);
});
