import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createContentSchemaValidators,
  loadContentSchema,
  schemaErrors
} from "../scripts/lib/schema.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validators = createContentSchemaValidators(loadContentSchema(repositoryRoot));

const publisher = {
  id: "PUB-DEMO",
  name: "demo",
  type: "individual_brand",
  homepage: "https://example.com/demo",
  updatedAt: "2026-10-20"
};
const collection = {
  id: "COL-DEMO",
  publisherId: publisher.id,
  title: "示例题集",
  sourceUrl: "https://example.com/questions.pdf",
  sourceKind: "curated_question_set",
  access: "public",
  capturedAt: "2026-10-20",
  lastCheckedAt: "2026-10-20",
  verification: "verified_source",
  sourceClaim: "示例来源声明",
  items: []
};

test("keeps publisher nicknames and collection attribution optional", () => {
  assert.deepEqual(schemaErrors(validators.publisher, publisher, "publisher"), []);
  assert.deepEqual(schemaErrors(validators.collection, collection, "collection"), []);
});

test("accepts an optional collection reading URL without replacing its original source", () => {
  const value = { ...collection, readingUrl: "https://mianstack.com/collection/col-demo" };
  assert.deepEqual(schemaErrors(validators.collection, value, "collection"), []);
  assert.equal(value.sourceUrl, collection.sourceUrl);
  for (const readingUrl of ["", "not-a-url", "javascript:alert(1)", null, 1])
    assert.ok(
      schemaErrors(validators.collection, { ...collection, readingUrl }, "collection").length > 0
    );
});

test("accepts a nonempty publisher nickname", () => {
  assert.deepEqual(
    schemaErrors(validators.publisher, { ...publisher, nickname: "示例昵称" }, "publisher"),
    []
  );
});

test("rejects empty and blank publisher nicknames", () => {
  for (const nickname of ["", " \t\n"])
    assert.ok(
      schemaErrors(validators.publisher, { ...publisher, nickname }, "publisher").some((message) =>
        /nickname must not be (empty|blank)/.test(message)
      )
    );
});

test("accepts original attribution with an optional HTTP(S) URL", () => {
  for (const sourceAttribution of [
    { name: "原作作者" },
    { name: "原作作者", url: "http://example.com/original.pdf" },
    { name: "原作作者", url: "https://example.com/original.pdf" }
  ])
    assert.deepEqual(
      schemaErrors(validators.collection, { ...collection, sourceAttribution }, "collection"),
      []
    );
});

test("requires a nonempty original attribution name", () => {
  for (const sourceAttribution of [
    {},
    { name: "" },
    { name: " \t\n" },
    { url: "https://example.com/original.pdf" }
  ])
    assert.ok(
      schemaErrors(validators.collection, { ...collection, sourceAttribution }, "collection").some(
        (message) => /sourceAttribution\.name (is required|must not be (empty|blank))/.test(message)
      )
    );
});

test("rejects non-HTTP(S) original attribution URLs", () => {
  for (const url of ["", "not-a-url", "ftp://example.com/original.pdf", "javascript:alert(1)"])
    assert.ok(
      schemaErrors(
        validators.collection,
        { ...collection, sourceAttribution: { name: "原作作者", url } },
        "collection"
      ).some((message) => message.includes("sourceAttribution.url has invalid mianstack-http-url"))
    );
});

test("accepts attribution roles and an explicit item scope without changing legacy attribution", () => {
  for (const role of ["author", "question_source", "compiler_responder"])
    assert.deepEqual(
      schemaErrors(
        validators.collection,
        {
          ...collection,
          sourceAttribution: {
            name: "来源署名",
            role,
            scope: "仅对应第一条原题。",
            itemIds: ["COL-DEMO-001"]
          }
        },
        "collection"
      ),
      []
    );
});

test("rejects unknown attribution roles and empty, duplicate, or blank scopes", () => {
  for (const fields of [
    { role: "collector" },
    { scope: "" },
    { scope: " \t\n" },
    { itemIds: [] },
    { itemIds: ["COL-DEMO-001", "COL-DEMO-001"] },
    { itemIds: [" "] }
  ])
    assert.ok(
      schemaErrors(
        validators.collection,
        { ...collection, sourceAttribution: { name: "来源署名", ...fields } },
        "collection"
      ).length > 0
    );
});
