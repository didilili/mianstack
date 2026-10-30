import test from "node:test";
import assert from "node:assert/strict";
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
  updatedAt: "2026-10-23"
};
const errors = (fields) =>
  schemaErrors(validators.publisher, { ...publisher, ...fields }, "publisher");

test("publisher biographies are optional and accept plain text introductions", () => {
  assert.deepEqual(errors({}), []);
  assert.deepEqual(errors({ bio: "开源教程作者。公众号：Demo。" }), []);
});

test("publisher biographies reject empty or non-text values", () => {
  for (const bio of ["", " ", "\n", null, 42, [], {}])
    assert.ok(errors({ bio }).length > 0, JSON.stringify(bio));
});
