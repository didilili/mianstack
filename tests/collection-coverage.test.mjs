import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createContentSchemaValidators,
  loadContentSchema,
  schemaErrors
} from "../scripts/lib/schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validators = createContentSchemaValidators(loadContentSchema(root));
const collection = {
  id: "COL-DEMO",
  publisherId: "PUB-DEMO",
  title: "综合题集",
  sourceUrl: "https://example.com/questions",
  sourceKind: "curated_question_set",
  access: "public",
  capturedAt: "2026-10-20",
  lastCheckedAt: "2026-10-20",
  verification: "verified_source",
  sourceClaim: "示例来源",
  items: []
};

test("collection coverage is optional and accepts multiple knowledge directions", () => {
  assert.deepEqual(schemaErrors(validators.collection, collection, "collection"), []);
  assert.deepEqual(
    schemaErrors(validators.collection, { ...collection, coverage: ["llm", "rag"] }, "collection"),
    []
  );
});

test("collection coverage rejects empty, duplicate and malformed direction lists", () => {
  for (const coverage of [[], ["rag", "rag"], [""], ["RAG 与知识系统"], "rag"])
    assert.ok(
      schemaErrors(validators.collection, { ...collection, coverage }, "collection").length
    );
});
