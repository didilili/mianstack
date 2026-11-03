import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "../scripts/lib/content.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalDocuments = new Map();
const generatedPaths = [
  "questions/Q-9000.md",
  "interviews/MJ-NC-2026-9000.md",
  "INDEX.md",
  "indexes/agent.md",
  "indexes/priority.md",
  "indexes/interviews.md",
  "indexes/collections.md",
  "collections/COL-DEMO.json"
];
let fixtureRoot;

function write(relativePath, value) {
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === "string" ? value : JSON.stringify(value));
}

function read(relativePath) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

function generate(...args) {
  return spawnSync(process.execPath, ["scripts/build-indexes.mjs", ...args], {
    cwd: fixtureRoot,
    encoding: "utf8"
  });
}

function snapshot() {
  return generatedPaths.map((relativePath) => ({
    relativePath,
    content: read(relativePath),
    modifiedAt: fs.statSync(path.join(fixtureRoot, relativePath), { bigint: true }).mtimeNs
  }));
}

test.before(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mianstack-index-test-"));
  for (const directory of ["scripts", "schema"])
    fs.cpSync(path.join(repositoryRoot, directory), path.join(fixtureRoot, directory), {
      recursive: true
    });
  fs.symlinkSync(path.join(repositoryRoot, "node_modules"), path.join(fixtureRoot, "node_modules"));

  const question = parseFrontmatter(
    fs.readFileSync(path.join(repositoryRoot, "examples/question.example.md"), "utf8"),
    "question.example.md"
  );
  question.data.priority = "优先准备";
  question.data.answerStatus = "ready";
  write("questions/Q-9000.md", `---\n${JSON.stringify(question.data)}\n---\n${question.body}`);
  write(
    "interviews/MJ-NC-2026-9000.md",
    fs.readFileSync(path.join(repositoryRoot, "examples/interview.example.md"), "utf8")
  );
  for (const relativePath of generatedPaths.slice(0, 2))
    originalDocuments.set(relativePath, read(relativePath));
  write("categories.json", [
    {
      id: "agent",
      title: "Agent",
      description: "Agent 分类",
      topics: [question.data.topic]
    }
  ]);
  write("aliases.json", []);
  write("publishers.json", [
    {
      id: "PUB-DEMO",
      name: "示例作者",
      type: "individual",
      homepage: "https://example.com/author",
      updatedAt: "2026-10-21"
    }
  ]);
  write("collections/COL-DEMO.json", {
    id: "COL-DEMO",
    publisherId: "PUB-DEMO",
    title: "示例题集",
    sourceUrl: "https://example.com/questions",
    sourceKind: "curated_question_set",
    access: "public",
    capturedAt: "2026-10-21",
    lastCheckedAt: "2026-10-21",
    verification: "verified_source",
    sourceClaim: "示例题集来源",
    items: []
  });
  const result = generate();
  assert.equal(result.status, 0, result.stderr);
});

test.after(() => {
  if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

test("question indexes keep repository titles beside online reading links and answer labels", () => {
  const questionLine =
    "- [Q-9000 Agent 如何根据任务选择和调用工具？](../questions/Q-9000.md) · [在线阅读](https://mianstack.com/question/q-9000) · **已有答案**";
  for (const relativePath of ["indexes/agent.md", "indexes/priority.md"])
    assert.ok(read(relativePath).includes(questionLine), relativePath);
});

test("interview index keeps the repository title and metadata beside its online reading link", () => {
  assert.ok(
    read("indexes/interviews.md").includes(
      "- [MJ-NC-2026-9000 示例公司 AI 应用开发工程师面经](../interviews/MJ-NC-2026-9000.md) · [在线阅读](https://mianstack.com/interview/mj-nc-2026-9000) — AI 应用开发工程师 · 2026-09-24"
    )
  );
});

test("collection index offers online reading while retaining its repository record and original source", () => {
  const index = read("indexes/collections.md");
  assert.ok(index.includes("[在线阅读](https://mianstack.com/collection/col-demo)"));
  assert.ok(index.includes("[仓库记录](../collections/COL-DEMO.json)"));
  assert.ok(index.includes("[原始来源](https://example.com/questions)"));
});

test("priority index links to the matching online review page", () => {
  assert.ok(
    read("indexes/priority.md").includes(
      "[返回题库总索引](../INDEX.md) · [在线阅读](https://mianstack.com/must-review)"
    )
  );
});

test("collection JSON gets its own reading URL while keeping the original source and items", () => {
  const collection = JSON.parse(read("collections/COL-DEMO.json"));
  assert.equal(collection.readingUrl, "https://mianstack.com/collection/col-demo");
  assert.equal(collection.sourceUrl, "https://example.com/questions");
  assert.deepEqual(collection.items, []);
});

test("generation adds online navigation to content files while preserving frontmatter and body", () => {
  for (const [relativePath, original] of originalDocuments) {
    const generated = read(relativePath);
    assert.ok(!generated.includes("<!--"), relativePath);
    assert.equal((generated.match(/^> 在面栈阅读：/gm) || []).length, 1, relativePath);
    const expectedUrl = relativePath.startsWith("questions/")
      ? "https://mianstack.com/question/q-9000"
      : "https://mianstack.com/interview/mj-nc-2026-9000";
    assert.ok(generated.includes(`](${expectedUrl})`), relativePath);
    assert.deepEqual(
      parseFrontmatter(generated, relativePath),
      parseFrontmatter(original, relativePath),
      relativePath
    );
  }
});

test("generation is idempotent after content navigation and indexes are current", () => {
  const before = snapshot();
  const result = generate();
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /^updated /m);
  assert.deepEqual(snapshot(), before);
  const check = generate("--check");
  assert.equal(check.status, 0, check.stderr);
  assert.deepEqual(snapshot(), before);
});

test("check reports stale content navigation without writing any generated files", () => {
  const relativePath = "questions/Q-9000.md";
  write(relativePath, read(relativePath).replace("/question/q-9000", "/question/q-0000"));
  const before = snapshot();
  const result = generate("--check");
  assert.equal(result.status, 1, result.stderr);
  assert.ok(result.stderr.includes(relativePath), result.stderr);
  assert.deepEqual(snapshot(), before);
});

test("check detects a missing collection reading URL and generation restores it", () => {
  const relativePath = "collections/COL-DEMO.json";
  const collection = JSON.parse(read(relativePath));
  delete collection.readingUrl;
  write(relativePath, collection);
  const before = snapshot();
  const check = generate("--check");
  assert.equal(check.status, 1, check.stderr);
  assert.ok(check.stderr.includes(relativePath), check.stderr);
  assert.deepEqual(snapshot(), before);
  const result = generate();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    JSON.parse(read(relativePath)).readingUrl,
    "https://mianstack.com/collection/col-demo"
  );
});

test("interview index preserves reasonable inferred role labels and omits empty roles", () => {
  const relativePath = "interviews/MJ-NC-2026-9000.md";
  const original = read(relativePath);
  const { data, body } = parseFrontmatter(original, relativePath);
  const contexts = [
    { company: "示例公司", role: "前端开发", roleMethod: "原文明示" },
    {
      company: "示例公司",
      role: "Agent 应用开发工程师",
      roleMethod: "面试内容推测",
      roleConfidence: "低"
    },
    {
      company: "示例公司",
      role: "后端开发",
      roleMethod: "面试内容推测",
      roleConfidence: "中"
    },
    {
      company: "示例公司",
      role: "",
      roleMethod: "资料不足",
      roleConfidence: "不可判定"
    }
  ];
  try {
    write(
      relativePath,
      `---\n${JSON.stringify({ ...data, title: "多场景面经", contexts })}\n---\n${body}`
    );
    const result = generate();
    assert.equal(result.status, 0, result.stderr);
    const index = read("indexes/interviews.md");
    assert.ok(
      index.includes(" — 前端开发、Agent 应用开发工程师（推测）、后端开发（推测） · 2026-09-24"),
      index
    );
    assert.doesNotMatch(index, /岗位无法判断|资料不足|不可判定/);
    assert.deepEqual(parseFrontmatter(read(relativePath), relativePath).data.contexts, contexts);
  } finally {
    write(relativePath, original);
    assert.equal(generate().status, 0);
  }
});
