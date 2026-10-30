#!/usr/bin/env node

// 从暂存区快照生成索引与阅读入口，避免把未暂存内容带进本次提交。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGeneratedPath, websiteContentLocation } from "./lib/content.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentPath =
  /^(?:(?:questions|interviews|collections)\/.+|(?:categories|aliases|publishers)\.json|schema\/content\.schema\.json|scripts\/(?:build-indexes\.mjs|lib\/.+\.mjs)|INDEX\.md|indexes\/[^/]+\.md)$/;
const updatedPath =
  /^(?:INDEX\.md|indexes\/[^/]+\.md|questions\/Q-[^/]+\.md|interviews\/MJ-[^/]+\.md|collections\/COL-[^/]+\.json)$/;

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `${executable} failed`);
  return result.stdout;
}

function git(...args) {
  return command("git", args);
}

function readFile(filename) {
  if (!fs.existsSync(filename)) return null;
  if (!fs.lstatSync(filename).isFile()) throw new Error(`Expected a regular file: ${filename}`);
  return fs.readFileSync(filename);
}

function equal(first, second) {
  return first === null ? second === null : second !== null && first.equals(second);
}

function indexEntries(env = process.env) {
  const entries = command(
    "git",
    [
      "ls-files",
      "--stage",
      "-z",
      "--",
      "INDEX.md",
      "indexes",
      "questions",
      "interviews",
      "collections"
    ],
    { env }
  );
  return new Map(
    entries
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("\t");
        return [entry.slice(separator + 1), entry.slice(0, separator)];
      })
  );
}

function partialCommitState() {
  const commitIndex = path.resolve(root, process.env.GIT_INDEX_FILE || "");
  const match = path.basename(commitIndex).match(/^next-index-(\d+)\.lock$/);
  if (!match) return null;
  const gitDirectory = git("rev-parse", "--absolute-git-dir").trim();
  if (path.dirname(commitIndex) !== gitDirectory) return null;
  return {
    filename: path.join(gitDirectory, `mianstack-partial-index-${match[1]}.json`),
    started: command("ps", ["-o", "lstart=", "-p", match[1]]).trim()
  };
}

function synchronizeCommittedIndexes(state) {
  const index = path.resolve(root, git("rev-parse", "--git-path", "index").trim());
  const lock = `${index}.lock`;
  const descriptor = fs.openSync(lock, "wx");
  let published = false;
  try {
    fs.copyFileSync(index, lock);
    if (state.tree !== git("rev-parse", "HEAD^{tree}").trim()) return;
    const env = { ...process.env, GIT_INDEX_FILE: lock };
    const current = indexEntries(env);
    const updates = state.updates.filter(
      (item) =>
        updatedPath.test(item.filename) && (current.get(item.filename) ?? null) === item.before
    );
    if (!updates.length) return;
    command("git", ["update-index", "-z", "--index-info"], {
      env,
      input: updates.map((item) => item.update).join("")
    });
    fs.renameSync(lock, index);
    published = true;
  } finally {
    fs.closeSync(descriptor);
    if (!published) fs.rmSync(lock, { force: true });
  }
}

function completePartialCommit() {
  const gitDirectory = git("rev-parse", "--absolute-git-dir").trim();
  const states = new Map();
  for (const filename of fs.readdirSync(gitDirectory)) {
    const match = filename.match(/^mianstack-partial-index-(\d+)\.json$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const absolute = path.join(gitDirectory, filename);
    try {
      process.kill(pid, 0);
      states.set(pid, absolute);
    } catch (error) {
      if (error.code === "ESRCH") fs.rmSync(absolute, { force: true });
    }
  }
  if (!states.size) return;
  // Husky/npm 会增加父进程层级；只接受本次 Git 提交进程留下的状态。
  let pid = process.ppid;
  for (let depth = 0; pid > 1 && depth < 32; depth++) {
    const filename = states.get(pid);
    if (filename) {
      const state = JSON.parse(fs.readFileSync(filename, "utf8"));
      try {
        if (state.started !== command("ps", ["-o", "lstart=", "-p", String(pid)]).trim()) return;
        synchronizeCommittedIndexes(state);
      } finally {
        fs.rmSync(filename, { force: true });
      }
      return;
    }
    pid = Number(command("ps", ["-o", "ppid=", "-p", String(pid)]).trim());
  }
}

function prepareIndexes() {
  const changed = git("diff", "--cached", "--name-only", "-z", "--no-renames").split("\0");
  if (
    !changed.some(
      (filename) =>
        websiteContentLocation(filename) ||
        (contentPath.test(filename) && !filename.endsWith("/README.md"))
    )
  )
    return;

  const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), "mianstack-staged-"));
  try {
    git("checkout-index", "--all", "--force", `--prefix=${snapshot}${path.sep}`);
    fs.symlinkSync(
      path.join(root, "node_modules"),
      path.join(snapshot, "node_modules"),
      "junction"
    );
    const previousPaths = git(
      "ls-files",
      "-z",
      "--",
      "INDEX.md",
      "indexes",
      "questions",
      "interviews",
      "collections"
    )
      .split("\0")
      .filter((filename) => updatedPath.test(filename));
    const previous = new Map(
      previousPaths.map((filename) => [
        filename,
        readFile(resolveGeneratedPath(snapshot, filename))
      ])
    );
    const buildScript = path.join(snapshot, "scripts/build-indexes.mjs");
    command(process.execPath, [buildScript], { cwd: snapshot });
    command(process.execPath, [buildScript, "--check"], { cwd: snapshot });
    const outputPaths = [
      "INDEX.md",
      ...fs
        .readdirSync(path.join(snapshot, "indexes"))
        .filter((filename) => filename.endsWith(".md"))
        .map((filename) => `indexes/${filename}`)
    ];
    const updates = [];
    const partialState = partialCommitState();
    const commitEntries = partialState ? indexEntries() : new Map();
    const partialUpdates = [];
    const workingUpdates = [];
    const preserved = [];
    for (const filename of new Set([...previousPaths, ...outputPaths])) {
      const before = previous.get(filename) ?? null;
      const after = readFile(resolveGeneratedPath(snapshot, filename));
      if (equal(before, after)) continue;
      const target = resolveGeneratedPath(root, filename);
      const working = readFile(target);
      if (equal(working, before)) workingUpdates.push({ target, after });
      else if (!equal(working, after)) preserved.push(filename);
      const hash =
        after === null
          ? "0".repeat(git("hash-object", "--stdin").trim().length)
          : command("git", ["hash-object", "-w", "--stdin"], { input: after }).trim();
      const update = `${after === null ? "0" : "100644"} ${hash}\t${filename}\0`;
      updates.push(update);
      if (partialState)
        partialUpdates.push({ filename, before: commitEntries.get(filename) ?? null, update });
    }
    // 生成和校验全部通过后才一次性更新暂存区；独立的工作区改动原样保留。
    if (updates.length) {
      command("git", ["update-index", "-z", "--index-info"], { input: updates.join("") });
      if (partialState)
        fs.writeFileSync(
          partialState.filename,
          JSON.stringify({
            started: partialState.started,
            tree: git("write-tree").trim(),
            updates: partialUpdates
          })
        );
      for (const { target, after } of workingUpdates) {
        if (after === null) fs.rmSync(target, { force: true });
        else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, after);
        }
      }
    }
    console.log(`已校验暂存内容并更新 ${updates.length} 个索引或阅读入口。`);
    if (preserved.length) console.log(`以下文件的未暂存改动已保留：${preserved.join("、")}`);
  } finally {
    fs.rmSync(snapshot, { recursive: true, force: true });
  }
}

try {
  if (process.argv[2] === "--after-commit") completePartialCommit();
  else {
    prepareIndexes();
    command("git", ["diff", "--cached", "--check", "--", ".", ":!interviews/*.md"]);
  }
} catch (error) {
  console.error(
    process.argv[2] === "--after-commit"
      ? `提交已完成，但生成索引的暂存状态同步失败：${error.message}`
      : error.message
  );
  process.exitCode = 1;
}
