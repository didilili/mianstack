// 在临时 Git 仓库验证提交自动化，覆盖部分暂存、失败保护和实际 hook。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories = new Set();
const questionPath = "questions/Q-0001.md";

test.after(() => {
  for (const directory of temporaryDirectories)
    fs.rmSync(directory, { recursive: true, force: true });
});

function run(root, command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" },
    ...options
  });
}

function git(root, ...args) {
  const result = run(root, "git", args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function write(root, relativePath, text) {
  fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  fs.writeFileSync(path.join(root, relativePath), text);
}

function question(title) {
  return `---\n${JSON.stringify(
    {
      id: "Q-0001",
      title,
      category: "agent",
      topic: "Agent 基础",
      type: "概念解释",
      level: "基础",
      priority: "按岗位选读",
      focus: "验证提交边界。",
      answerStatus: "pending",
      updatedAt: "2026-10-14"
    },
    null,
    2
  )}\n---\n`;
}

function collection(title, id = "COL-TEST") {
  return {
    id,
    publisherId: "PUB-TEST",
    title,
    sourceUrl: "https://example.com/questions",
    sourceKind: "curated_question_set",
    access: "public",
    capturedAt: "2026-10-21",
    lastCheckedAt: "2026-10-21",
    verification: "verified_source",
    sourceClaim: "测试题集来源。",
    items: [
      {
        id: `${id}-001`,
        originalTitle: "原始问法",
        sourceUrl: "https://example.com/questions#first",
        reviewStatus: "confirmed"
      }
    ]
  };
}

function writeCollectionPublisher(root) {
  write(
    root,
    "publishers.json",
    JSON.stringify([
      { id: "PUB-TEST", name: "测试发布者", type: "individual", updatedAt: "2026-10-21" }
    ])
  );
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mianstack-commit-test-"));
  temporaryDirectories.add(root);
  fs.cpSync(path.join(repositoryRoot, "scripts"), path.join(root, "scripts"), { recursive: true });
  fs.cpSync(path.join(repositoryRoot, "schema"), path.join(root, "schema"), { recursive: true });
  fs.symlinkSync(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    "junction"
  );
  write(root, ".gitignore", "node_modules\n.husky/_/\n");
  write(root, ".prettierignore", "INDEX.md\nindexes/\ninterviews/\n");
  write(root, questionPath, question("原始题目"));
  for (const directory of ["interviews", "collections"])
    write(root, `${directory}/README.md`, "# 目录说明\n");
  write(
    root,
    "categories.json",
    JSON.stringify([
      {
        id: "agent",
        title: "Agent",
        description: "Agent 分类",
        topics: ["Agent 基础"]
      }
    ])
  );
  for (const filename of ["aliases.json", "publishers.json"]) write(root, filename, "[]\n");
  write(root, "README.md", "# 测试仓库\n");
  git(root, "init", "--quiet");
  git(root, "config", "user.name", "Hook test");
  git(root, "config", "user.email", "hook-test@example.com");
  const generated = run(root, process.execPath, ["scripts/build-indexes.mjs"]);
  assert.equal(generated.status, 0, generated.stderr);
  git(root, "add", ".");
  git(root, "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "fixture");
  return root;
}

function prepare(root, options) {
  return run(root, process.execPath, ["scripts/prepare-commit.mjs"], options);
}

test("generates and stages indexes using only staged content", () => {
  const root = fixture();
  write(root, questionPath, question("暂存题目"));
  git(root, "add", questionPath);
  write(root, questionPath, question("未暂存题目"));
  write(root, "questions/Q-0002.md", "无效但未暂存的新增文件\n");

  const result = prepare(root);
  assert.equal(result.status, 0, result.stderr);
  const stagedIndex = git(root, "show", ":indexes/agent.md");
  assert.match(stagedIndex, /暂存题目/);
  assert.doesNotMatch(stagedIndex, /未暂存题目/);
  assert.match(
    git(root, "show", `:${questionPath}`),
    /https:\/\/mianstack\.com\/question\/q-0001\)/
  );
  assert.equal(fs.readFileSync(path.join(root, questionPath), "utf8"), question("未暂存题目"));
  assert.equal(fs.readFileSync(path.join(root, "indexes/agent.md"), "utf8"), stagedIndex);
  assert.doesNotMatch(git(root, "diff", "--cached", "--name-only"), /Q-0002/);
});

test("stages generated reading links for question and interview Markdown", () => {
  const root = fixture();
  const interviewPath = "interviews/MJ-NC-2026-9000.md";
  const interview = fs.readFileSync(
    path.join(repositoryRoot, "examples/interview.example.md"),
    "utf8"
  );
  write(root, questionPath, question("暂存题目"));
  write(root, interviewPath, interview);
  git(root, "add", questionPath, interviewPath);
  const workingInterview = `${interview}\n未暂存的正文补充。\n`;
  write(root, interviewPath, workingInterview);
  const result = prepare(root);

  assert.equal(result.status, 0, result.stderr);
  const stagedQuestion = git(root, "show", `:${questionPath}`);
  const stagedInterview = git(root, "show", `:${interviewPath}`);
  assert.match(stagedQuestion, /https:\/\/mianstack\.com\/question\/q-0001\)/);
  assert.match(stagedInterview, /https:\/\/mianstack\.com\/interview\/mj-nc-2026-9000\)/);
  assert.doesNotMatch(stagedInterview, /未暂存的正文补充/);
  assert.equal(fs.readFileSync(path.join(root, questionPath), "utf8"), stagedQuestion);
  assert.equal(fs.readFileSync(path.join(root, interviewPath), "utf8"), workingInterview);
});

test("stages collection reading links using only staged JSON and preserves working edits", () => {
  const root = fixture();
  const collectionPath = "collections/COL-TEST.json";
  const stagedCollection = collection("暂存题集");
  writeCollectionPublisher(root);
  write(root, collectionPath, JSON.stringify(stagedCollection, null, 2));
  git(root, "add", "publishers.json", collectionPath);
  const workingCollection = `${JSON.stringify(collection("未暂存题集"), null, 2)}\n`;
  write(root, collectionPath, workingCollection);

  const result = prepare(root);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(git(root, "show", `:${collectionPath}`)), {
    ...stagedCollection,
    readingUrl: "https://mianstack.com/collection/col-test"
  });
  assert.equal(fs.readFileSync(path.join(root, collectionPath), "utf8"), workingCollection);
});

test("preserves independently modified generated files in the working tree", () => {
  const root = fixture();
  write(root, questionPath, question("暂存题目"));
  git(root, "add", questionPath);
  write(root, "indexes/agent.md", "# 尚未提交的索引内容\n");

  const result = prepare(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(git(root, "show", ":indexes/agent.md"), /暂存题目/);
  assert.equal(
    fs.readFileSync(path.join(root, "indexes/agent.md"), "utf8"),
    "# 尚未提交的索引内容\n"
  );
});

test("rejects invalid staged content without changing the index or generated files", () => {
  const root = fixture();
  write(root, questionPath, "---\n{invalid}\n---\n");
  git(root, "add", questionPath);
  const before = git(root, "write-tree");
  const indexBefore = fs.readFileSync(path.join(root, "INDEX.md"), "utf8");

  const result = prepare(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Q-0001.md.*invalid JSON/);
  assert.equal(git(root, "write-tree"), before);
  assert.equal(fs.readFileSync(path.join(root, "INDEX.md"), "utf8"), indexBefore);
});

test("skips content generation for documentation-only commits", () => {
  const root = fixture();
  write(root, "README.md", "# 文档更新\n");
  git(root, "add", "README.md");
  write(root, questionPath, "未暂存的无效内容\n");
  const before = git(root, "write-tree");

  const result = prepare(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(root, "write-tree"), before);
});

test("rejects unexpected file types staged inside content directories", () => {
  const root = fixture();
  write(root, "questions/unexpected.json", "[]\n");
  git(root, "add", "questions/unexpected.json");
  const before = git(root, "write-tree");
  const result = prepare(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid question filename: unexpected.json/);
  assert.equal(git(root, "write-tree"), before);
});

for (const privatePath of [
  "relationships/MJ-NC-2026-9000.json",
  "relationships/README.md",
  "projects/demo.json",
  "families.json",
  "question-relations.json",
  "collection-relations/COL-DEMO.json"
]) {
  test(`rejects a staged private path ${privatePath} even when absent from the working tree`, () => {
    const root = fixture();
    write(root, privatePath, privatePath.endsWith(".md") ? "# 私有关系目录\n" : "[]\n");
    git(root, "add", privatePath);
    fs.unlinkSync(path.join(root, privatePath));
    const before = git(root, "write-tree");
    const indexBefore = fs.readFileSync(path.join(root, "INDEX.md"), "utf8");

    const result = prepare(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /mianstack-web\/content\//);
    assert.ok(result.stderr.includes(privatePath.split("/")[0]), result.stderr);
    assert.equal(git(root, "write-tree"), before);
    assert.equal(fs.readFileSync(path.join(root, "INDEX.md"), "utf8"), indexBefore);
    assert.equal(fs.existsSync(path.join(root, privatePath)), false);
  });
}

test("ignores unstaged private paths while preparing staged public content", () => {
  const root = fixture();
  const privatePaths = [
    "relationships/README.md",
    "projects/demo.json",
    "families.json",
    "question-relations.json",
    "collection-relations/COL-DEMO.json"
  ];
  for (const privatePath of privatePaths) write(root, privatePath, "未暂存的内容\n");
  write(root, questionPath, question("暂存题目"));
  git(root, "add", questionPath);

  const result = prepare(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(git(root, "show", ":indexes/agent.md"), /暂存题目/);
  for (const privatePath of privatePaths) {
    assert.equal(fs.readFileSync(path.join(root, privatePath), "utf8"), "未暂存的内容\n");
    assert.equal(git(root, "ls-files", "--", privatePath), "");
  }
});

test("accepts a staged private-path removal while preserving its unstaged working copy", () => {
  const root = fixture();
  const privatePath = "relationships/MJ-NC-2026-9000.json";
  write(root, privatePath, "[]\n");
  git(root, "add", privatePath);
  git(root, "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "legacy fixture");
  git(root, "rm", "--quiet", "--", privatePath);
  write(root, privatePath, "未暂存的旧文件副本\n");
  const before = git(root, "write-tree");

  const result = prepare(root);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(git(root, "write-tree"), before);
  assert.equal(git(root, "ls-files", "--", privatePath), "");
  assert.equal(fs.readFileSync(path.join(root, privatePath), "utf8"), "未暂存的旧文件副本\n");
});

test("uses the alternate Git index supplied by the commit command", () => {
  const root = fixture();
  const realIndex = fs.readFileSync(path.join(root, ".git/index"));
  const alternateIndex = path.join(root, ".git/alternate-index");
  fs.writeFileSync(alternateIndex, realIndex);
  const env = { ...process.env, GIT_INDEX_FILE: alternateIndex };
  write(root, questionPath, question("临时暂存题目"));
  const staged = run(root, "git", ["add", questionPath], { env });
  assert.equal(staged.status, 0, staged.stderr);

  const result = prepare(root, { env });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readFileSync(path.join(root, ".git/index")), realIndex);
  const stagedIndex = run(root, "git", ["show", ":indexes/agent.md"], { env });
  assert.match(stagedIndex.stdout, /临时暂存题目/);
});

function partialCommitFixture() {
  const root = fixture();
  write(root, ".git/hooks/pre-commit", "#!/bin/sh\nexec node scripts/prepare-commit.mjs\n");
  fs.chmodSync(path.join(root, ".git/hooks/pre-commit"), 0o755);
  write(
    root,
    ".git/hooks/post-commit",
    "#!/bin/sh\nexec node scripts/prepare-commit.mjs --after-commit\n"
  );
  fs.chmodSync(path.join(root, ".git/hooks/post-commit"), 0o755);
  write(root, questionPath, question("本次题目"));
  return root;
}

test("keeps the main index clean after a real commit --only", () => {
  const root = partialCommitFixture();
  write(root, "README.md", "# 另一次提交的文档\n");
  write(root, "questions/Q-0002.md", question("另一次提交的题目").replace("Q-0001", "Q-0002"));
  git(root, "add", "README.md", "questions/Q-0002.md");

  git(root, "commit", "--quiet", "--only", "-m", "test: partial", "--", questionPath);

  assert.match(git(root, "show", "HEAD:indexes/agent.md"), /本次题目/);
  assert.match(
    git(root, "show", `HEAD:${questionPath}`),
    /https:\/\/mianstack\.com\/question\/q-0001\)/
  );
  assert.doesNotMatch(git(root, "show", "HEAD:indexes/agent.md"), /另一次提交的题目/);
  assert.deepEqual(git(root, "diff", "--cached", "--name-only").trim().split("\n"), [
    "README.md",
    "questions/Q-0002.md"
  ]);
  assert.equal(git(root, "diff", "--name-only"), "");
});

test("preserves independently staged Markdown while synchronizing commit --only reading links", () => {
  const root = fixture();
  const otherQuestionPath = "questions/Q-0002.md";
  const originalQuestion = question("另一道原始题目").replace("Q-0001", "Q-0002");
  write(root, otherQuestionPath, originalQuestion);
  git(root, "add", otherQuestionPath);
  git(root, "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "fixture: old Markdown");
  write(root, ".git/hooks/pre-commit", "#!/bin/sh\nexec node scripts/prepare-commit.mjs\n");
  fs.chmodSync(path.join(root, ".git/hooks/pre-commit"), 0o755);
  write(
    root,
    ".git/hooks/post-commit",
    "#!/bin/sh\nexec node scripts/prepare-commit.mjs --after-commit\n"
  );
  fs.chmodSync(path.join(root, ".git/hooks/post-commit"), 0o755);
  write(root, questionPath, question("本次题目"));
  const independentQuestion = question("独立暂存的另一道题目").replace("Q-0001", "Q-0002");
  write(root, otherQuestionPath, independentQuestion);
  git(root, "add", otherQuestionPath);

  git(root, "commit", "--quiet", "--only", "-m", "test: partial reading links", "--", questionPath);

  const committedOtherQuestion = git(root, "show", `HEAD:${otherQuestionPath}`);
  assert.match(committedOtherQuestion, /https:\/\/mianstack\.com\/question\/q-0002\)/);
  assert.match(committedOtherQuestion, /另一道原始题目/);
  assert.doesNotMatch(committedOtherQuestion, /独立暂存/);
  assert.equal(git(root, "show", `:${otherQuestionPath}`), independentQuestion);
  assert.equal(fs.readFileSync(path.join(root, otherQuestionPath), "utf8"), independentQuestion);
  assert.equal(git(root, "diff", "--cached", "--name-only"), `${otherQuestionPath}\n`);
  assert.equal(git(root, "diff", "--name-only"), "");
});

test("synchronizes collection reading links during commit --only and preserves independent edits", () => {
  const root = partialCommitFixture();
  const collectionPath = "collections/COL-TEST.json";
  const otherCollectionPath = "collections/COL-OTHER.json";
  const originalCollection = collection("原始题集");
  const originalOtherCollection = collection("另一份原始题集", "COL-OTHER");
  writeCollectionPublisher(root);
  write(root, collectionPath, JSON.stringify(originalCollection, null, 2));
  write(root, otherCollectionPath, JSON.stringify(originalOtherCollection, null, 2));
  git(root, "add", "publishers.json", collectionPath, otherCollectionPath);
  git(root, "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "fixture: old JSON");
  const stagedOtherCollection = JSON.stringify(collection("独立暂存题集", "COL-OTHER"), null, 2);
  write(root, otherCollectionPath, stagedOtherCollection);
  git(root, "add", otherCollectionPath);
  const workingOtherCollection = JSON.stringify(collection("未暂存题集", "COL-OTHER"), null, 2);
  write(root, otherCollectionPath, workingOtherCollection);

  git(
    root,
    "commit",
    "--quiet",
    "--only",
    "-m",
    "test: partial collection links",
    "--",
    questionPath
  );

  const committedCollection = git(root, "show", `HEAD:${collectionPath}`);
  assert.deepEqual(JSON.parse(committedCollection), {
    ...originalCollection,
    readingUrl: "https://mianstack.com/collection/col-test"
  });
  assert.equal(git(root, "show", `:${collectionPath}`), committedCollection);
  assert.equal(fs.readFileSync(path.join(root, collectionPath), "utf8"), committedCollection);
  assert.deepEqual(JSON.parse(git(root, "show", `HEAD:${otherCollectionPath}`)), {
    ...originalOtherCollection,
    readingUrl: "https://mianstack.com/collection/col-other"
  });
  assert.equal(git(root, "show", `:${otherCollectionPath}`), stagedOtherCollection);
  assert.equal(
    fs.readFileSync(path.join(root, otherCollectionPath), "utf8"),
    workingOtherCollection
  );
  assert.equal(git(root, "diff", "--cached", "--name-only"), `${otherCollectionPath}\n`);
  assert.equal(git(root, "diff", "--name-only"), `${otherCollectionPath}\n`);
});

test("keeps a custom index clean after commit --only without touching the default index", () => {
  const root = partialCommitFixture();
  const defaultIndex = fs.readFileSync(path.join(root, ".git/index"));
  const alternateIndex = path.join(root, ".git/alternate-index");
  fs.writeFileSync(alternateIndex, defaultIndex);
  const env = { ...process.env, GIT_INDEX_FILE: alternateIndex };
  write(root, "README.md", "# 独立索引中的文档\n");
  assert.equal(run(root, "git", ["add", "README.md"], { env }).status, 0);

  const committed = run(
    root,
    "git",
    ["commit", "--quiet", "--only", "-m", "test: custom partial", "--", questionPath],
    { env }
  );

  assert.equal(committed.status, 0, `${committed.stdout}\n${committed.stderr}`);
  assert.deepEqual(fs.readFileSync(path.join(root, ".git/index")), defaultIndex);
  assert.equal(
    run(root, "git", ["diff", "--cached", "--name-only"], { env }).stdout,
    "README.md\n"
  );
  assert.equal(run(root, "git", ["diff", "--name-only"], { env }).stdout, "");
});

test("preserves an independently staged generated file during commit --only", () => {
  const root = partialCommitFixture();
  const independentIndex = "# 独立暂存的索引改动\n";
  write(root, "indexes/agent.md", independentIndex);
  git(root, "add", "indexes/agent.md");

  git(root, "commit", "--quiet", "--only", "-m", "test: partial", "--", questionPath);

  assert.match(git(root, "show", "HEAD:indexes/agent.md"), /本次题目/);
  assert.equal(git(root, "show", ":indexes/agent.md"), independentIndex);
  assert.equal(fs.readFileSync(path.join(root, "indexes/agent.md"), "utf8"), independentIndex);
  assert.equal(git(root, "diff", "--name-only"), "");
});

test("does not change the main index when a partial commit is aborted later", () => {
  const root = partialCommitFixture();
  write(root, "README.md", "# 保留暂存文档\n");
  git(root, "add", "README.md");
  const before = git(root, "write-tree");
  write(root, ".git/hooks/commit-msg", "#!/bin/sh\nexit 1\n");
  fs.chmodSync(path.join(root, ".git/hooks/commit-msg"), 0o755);

  const result = run(root, "git", [
    "commit",
    "--quiet",
    "--only",
    "-m",
    "test: aborted",
    "--",
    questionPath
  ]);

  assert.notEqual(result.status, 0);
  assert.equal(git(root, "write-tree"), before);
});

test("does not replay state from an aborted commit on a later same-tree --no-verify commit", () => {
  const root = partialCommitFixture();
  const oldIndex = fs.readFileSync(path.join(root, "indexes/agent.md"), "utf8");
  write(root, ".git/hooks/commit-msg", "#!/bin/sh\nexit 1\n");
  fs.chmodSync(path.join(root, ".git/hooks/commit-msg"), 0o755);
  const aborted = run(root, "git", [
    "commit",
    "--quiet",
    "--only",
    "-m",
    "test: abort",
    "--",
    questionPath
  ]);
  assert.notEqual(aborted.status, 0);
  assert.ok(
    fs
      .readdirSync(path.join(root, ".git"))
      .some((name) => name.startsWith("mianstack-partial-index-"))
  );
  fs.rmSync(path.join(root, ".git/hooks/commit-msg"));
  git(root, "add", questionPath, "indexes/agent.md");
  git(root, "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "test: same tree");
  const tree = git(root, "rev-parse", "HEAD^{tree}");
  write(root, "indexes/agent.md", oldIndex);
  git(root, "add", "indexes/agent.md");

  git(
    root,
    "commit",
    "--quiet",
    "--allow-empty",
    "--no-verify",
    "--only",
    "-m",
    "test: keep staged revert",
    "--",
    "README.md"
  );

  assert.equal(git(root, "rev-parse", "HEAD^{tree}"), tree);
  assert.equal(git(root, "show", ":indexes/agent.md"), oldIndex);
  assert.equal(git(root, "diff", "--cached", "--name-only"), "indexes/agent.md\n");
  assert.equal(
    fs
      .readdirSync(path.join(root, ".git"))
      .some((name) => name.startsWith("mianstack-partial-index-")),
    false
  );
});

test("completes partial index synchronization through the installed Husky hooks", () => {
  const root = fixture();
  fs.copyFileSync(path.join(repositoryRoot, "package.json"), path.join(root, "package.json"));
  fs.cpSync(path.join(repositoryRoot, ".husky"), path.join(root, ".husky"), {
    recursive: true,
    filter: (filename) => path.basename(filename) !== "_"
  });
  // Isolate index generation from the existing formatting hook in this fixture.
  write(root, ".husky/pre-commit", "node scripts/prepare-commit.mjs\n");
  const env = {
    ...process.env,
    HUSKY: "1",
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1"
  };
  const installed = run(root, "npm", ["run", "prepare"], { env });
  assert.equal(installed.status, 0, installed.stderr);
  write(root, questionPath, question("Husky 部分提交题目"));

  const committed = run(
    root,
    "git",
    ["commit", "--quiet", "--only", "-m", "test: husky partial", "--", questionPath],
    { env }
  );

  assert.equal(committed.status, 0, `${committed.stdout}\n${committed.stderr}`);
  assert.match(git(root, "show", "HEAD:indexes/agent.md"), /Husky 部分提交题目/);
  assert.equal(git(root, "diff", "--cached", "--name-only"), "");
  assert.equal(git(root, "diff", "--name-only", "--", "INDEX.md", "indexes"), "");
});

test("holds the real index lock while comparing and synchronizing generated entries", () => {
  const root = partialCommitFixture();
  const realGit = run(root, "which", ["git"]).stdout.trim();
  const wrapper = path.join(root, "review-bin/git");
  write(
    root,
    "review-bin/git",
    `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const args = process.argv.slice(2);
const real = ${JSON.stringify(realGit)};
const output = cp.spawnSync(real, args, { encoding: 'utf8', input: fs.readFileSync(0) });
if (args[0] === 'ls-files') {
  const content = '# concurrent generated edit\\n';
  const hash = cp.spawnSync(real, ['hash-object', '-w', '--stdin'], { input: content, encoding: 'utf8' }).stdout.trim();
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  const staged = cp.spawnSync(real, ['update-index', '--index-info'], { input: '100644 ' + hash + '\\tindexes/agent.md\\n', encoding: 'utf8', env });
  fs.writeFileSync('.concurrent-stage-result', JSON.stringify({ status: staged.status, stderr: staged.stderr }));
}
process.stdout.write(output.stdout || '');
process.stderr.write(output.stderr || '');
process.exit(output.status ?? 1);
`
  );
  fs.chmodSync(wrapper, 0o755);
  write(
    root,
    ".git/hooks/post-commit",
    `#!/bin/sh\nPATH="${path.dirname(wrapper)}:$PATH" exec node scripts/prepare-commit.mjs --after-commit\n`
  );
  fs.chmodSync(path.join(root, ".git/hooks/post-commit"), 0o755);

  const committed = run(root, "git", [
    "commit",
    "--quiet",
    "--only",
    "-m",
    "test: concurrent",
    "--",
    questionPath
  ]);

  assert.equal(committed.status, 0, committed.stderr);
  assert.doesNotMatch(committed.stderr, /同步失败/);
  const concurrent = JSON.parse(
    fs.readFileSync(path.join(root, ".concurrent-stage-result"), "utf8")
  );
  assert.notEqual(concurrent.status, 0);
  assert.match(concurrent.stderr, /index\.lock/);
  assert.match(git(root, "show", ":indexes/agent.md"), /本次题目/);
  assert.equal(git(root, "diff", "--cached", "--name-only"), "");
});

test("removes obsolete generated category indexes", () => {
  const root = fixture();
  write(root, "indexes/obsolete.md", "> 本文件由 `npm run build:indexes` 生成，请勿手工修改。\n");
  git(root, "add", "indexes/obsolete.md");

  const result = prepare(root);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(git(root, "ls-files", "indexes"), /obsolete/);
  assert.equal(fs.existsSync(path.join(root, "indexes/obsolete.md")), false);
});

test("reports missing index directories as outdated rather than crashing", () => {
  const root = fixture();
  fs.rmSync(path.join(root, "indexes"), { recursive: true });
  const result = run(root, process.execPath, ["scripts/build-indexes.mjs", "--check"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Outdated generated indexes/);
  assert.doesNotMatch(result.stderr, /ENOENT/);
});

test("rejects unexpected handwritten indexes without deleting them", () => {
  const root = fixture();
  write(root, "indexes/handwritten.md", "# 独立维护的说明\n");
  git(root, "add", "indexes/handwritten.md");
  const before = git(root, "write-tree");
  const result = prepare(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /handwritten.md \(unexpected file\)/);
  assert.equal(git(root, "write-tree"), before);
  assert.equal(
    fs.readFileSync(path.join(root, "indexes/handwritten.md"), "utf8"),
    "# 独立维护的说明\n"
  );
});

test("runs formatting and index generation automatically during a real commit", () => {
  const root = fixture();
  for (const filename of ["package.json", "lint-staged.config.mjs", ".prettierrc.json"])
    fs.copyFileSync(path.join(repositoryRoot, filename), path.join(root, filename));
  fs.cpSync(path.join(repositoryRoot, ".husky"), path.join(root, ".husky"), {
    recursive: true,
    filter: (filename) => path.basename(filename) !== "_"
  });
  const hookEnvironment = {
    ...process.env,
    HUSKY: "1",
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1"
  };
  const installed = run(root, "npm", ["run", "prepare"], { env: hookEnvironment });
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(git(root, "config", "--get", "core.hooksPath").trim(), ".husky/_");
  write(root, questionPath, question("提交题目"));
  write(root, "check formatting.json", '{"value":1}\n');
  git(root, "add", questionPath, "check formatting.json");
  write(root, questionPath, question("后续未暂存题目"));

  const committed = run(root, "git", ["commit", "--quiet", "-m", "test: hooks"], {
    env: hookEnvironment
  });
  assert.equal(committed.status, 0, `${committed.stdout}\n${committed.stderr}`);
  assert.equal(git(root, "show", "HEAD:check formatting.json"), '{ "value": 1 }\n');
  assert.match(git(root, "show", "HEAD:indexes/agent.md"), /提交题目/);
  assert.doesNotMatch(git(root, "show", "HEAD:indexes/agent.md"), /后续未暂存题目/);
  assert.equal(fs.readFileSync(path.join(root, questionPath), "utf8"), question("后续未暂存题目"));
});
