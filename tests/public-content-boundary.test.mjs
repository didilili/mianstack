import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadContent } from "../scripts/lib/content.mjs";
import {
  createContentSchemaValidators,
  loadContentSchema,
  schemaErrors
} from "../scripts/lib/schema.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const question = {
  id: "Q-0001",
  title: "工具调用如何执行？",
  category: "agent",
  topic: "工具调用",
  type: "原理机制",
  level: "基础",
  priority: "按岗位选读",
  focus: "说明调用和结果回传。",
  answerStatus: "pending",
  updatedAt: "2026-10-30"
};
const item = {
  id: "COL-DEMO-001",
  originalTitle: "工具调用如何执行？",
  sourceUrl: "https://example.com/questions#1",
  reviewStatus: "confirmed",
  reviewNote: "原题未注明工具类型。"
};
const collection = {
  id: "COL-DEMO",
  publisherId: "PUB-DEMO",
  title: "示例题集",
  sourceUrl: "https://example.com/questions",
  sourceKind: "curated_question_set",
  access: "public",
  capturedAt: "2026-10-30",
  lastCheckedAt: "2026-10-30",
  verification: "verified_source",
  sourceClaim: "保留原题与来源。",
  items: [item]
};

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mianstack-public-only-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ["schema", "questions", "interviews", "collections"])
    fs.mkdirSync(path.join(root, directory));
  fs.copyFileSync(
    path.join(repositoryRoot, "schema/content.schema.json"),
    path.join(root, "schema/content.schema.json")
  );
  fs.writeFileSync(
    path.join(root, "questions/Q-0001.md"),
    `---\n${JSON.stringify(question)}\n---\n`
  );
  for (const [filename, value] of [
    [
      "categories.json",
      [{ id: "agent", title: "Agent", description: "Agent", topics: ["工具调用"] }]
    ],
    ["aliases.json", []],
    [
      "publishers.json",
      [{ id: "PUB-DEMO", name: "来源作者", type: "individual", updatedAt: "2026-10-30" }]
    ],
    ["collections/COL-DEMO.json", collection]
  ])
    fs.writeFileSync(path.join(root, filename), JSON.stringify(value));
  return root;
}

test("loads public content without private graph files and does not invent empty graph results", (t) => {
  const root = fixture(t);
  const content = loadContent(root);
  assert.equal(content.questions.length, 1);
  assert.deepEqual(content.collections[0].items[0], item);
  for (const field of ["relationships", "occurrences", "unresolved", "families"])
    assert.equal(Object.hasOwn(content, field), false, field);
  for (const field of ["relations", "familyId", "sourceCount"])
    assert.equal(Object.hasOwn(content.questions[0], field), false, field);
});

for (const privatePath of [
  "relationships",
  "projects",
  "families.json",
  "question-relations.json",
  "collection-relations"
]) {
  test(`rejects the website-owned root path ${privatePath}`, (t) => {
    const root = fixture(t);
    const target = path.join(root, privatePath);
    if (privatePath.endsWith(".json")) fs.writeFileSync(target, "[]\n");
    else fs.mkdirSync(target);

    assert.throws(
      () => loadContent(root),
      (error) => {
        assert.ok(error.message.includes(privatePath), error.message);
        assert.ok(error.message.includes(`mianstack-web/content/${privatePath}`), error.message);
        return true;
      }
    );
  });
}

test("keeps unrelated repository directories outside the private-path check", (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, "resources"));
  fs.writeFileSync(path.join(root, "resources/README.md"), "# 其他资料\n");
  assert.doesNotThrow(() => loadContent(root));
});

test("rejects a dangling symbolic link at a website-owned root path", (t) => {
  const root = fixture(t);
  fs.symlinkSync(
    path.join(root, "missing-private-relationships"),
    path.join(root, "relationships")
  );
  assert.throws(() => loadContent(root), /mianstack-web\/content\/relationships/);
});

test("public collection validation preserves every review status and its reading note without matches", () => {
  const validators = createContentSchemaValidators(loadContentSchema(repositoryRoot));
  for (const reviewStatus of ["confirmed", "new_candidate", "needs_review", "excluded"])
    assert.deepEqual(
      schemaErrors(
        validators.collection,
        { ...collection, items: [{ ...item, reviewStatus }] },
        "collection"
      ),
      [],
      reviewStatus
    );
});

test("public question validation rejects private question relations", () => {
  const validators = createContentSchemaValidators(loadContentSchema(repositoryRoot));
  const errors = schemaErrors(
    validators.question,
    {
      ...question,
      relations: [{ type: "相关题", target: "Q-0002" }]
    },
    "question"
  );
  assert.ok(
    errors.some((error) => error.includes("relations is not allowed")),
    errors.join("\n")
  );
});

test("public collection validation rejects private matches and presentation", () => {
  const validators = createContentSchemaValidators(loadContentSchema(repositoryRoot));
  const errors = schemaErrors(
    validators.collection,
    {
      ...collection,
      items: [
        {
          ...item,
          matches: [{ questionId: "Q-0001", relation: "equivalent" }],
          presentation: {
            mode: "subquestions",
            parts: [
              { text: "工具调用", questionIds: ["Q-0001"] },
              { text: "如何执行", questionIds: [] }
            ]
          }
        }
      ]
    },
    "collection"
  );
  for (const field of ["matches", "presentation"])
    assert.ok(
      errors.some((error) => error.includes(`${field} is not allowed`)),
      errors.join("\n")
    );
});
