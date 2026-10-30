import assert from "node:assert/strict";
import test from "node:test";
import { createContentSchemaValidators, loadContentSchema } from "../scripts/lib/schema.mjs";

test("consumers can validate their own records against canonical field definitions", () => {
  const canonical = loadContentSchema(new URL("..", import.meta.url).pathname);
  const schema = {
    ...canonical,
    $defs: {
      ...canonical.$defs,
      consumerRecord: {
        type: "object",
        required: ["questionId"],
        additionalProperties: false,
        properties: { questionId: { $ref: "#/$defs/questionId" } }
      }
    }
  };
  const validators = createContentSchemaValidators(schema, ["consumerRecord"]);
  assert.deepEqual(Object.keys(validators), ["consumerRecord"]);
  assert.equal(validators.consumerRecord({ questionId: "Q-0001" }), true);
  assert.equal(validators.consumerRecord({ questionId: "invalid" }), false);
});
