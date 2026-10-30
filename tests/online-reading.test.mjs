import assert from "node:assert/strict";
import test from "node:test";

import { parseFrontmatter } from "../scripts/lib/content.mjs";
import {
  onlineReadingUrl,
  stripOnlineReadingLink,
  withOnlineReadingLink,
  withCollectionReadingUrl
} from "../scripts/lib/online-reading.mjs";

const navigation = "\n> 在面栈阅读：[示例问题](https://mianstack.com/question/q-0001)\n";

test("removes generated reading navigation before returning the answer body", () => {
  const body = "\n## 核心回答\n\n原始答案。\n\n资料核对：2026-10-17\n";
  const metadata = { id: "Q-0001", title: "示例问题", updatedAt: "2026-10-17" };
  const parsed = parseFrontmatter(
    `---\n${JSON.stringify(metadata)}\n---\n${navigation}${body}`,
    "questions/Q-0001.md"
  );
  assert.deepEqual(parsed, { data: metadata, body });
});

test("a pending question containing only reading navigation still has an empty body", () => {
  const parsed = parseFrontmatter(
    `---\n{"id":"Q-0001","answerStatus":"pending"}\n---\n${navigation}`,
    "questions/Q-0001.md"
  );
  assert.equal(parsed.body, "");
});

test("keeps ordinary links and navigation examples within the actual body", () => {
  for (const body of [
    "> 在面栈阅读：[手写说明](https://mianstack.com/question/q-0001/)\n",
    `## 代码示例\n\n\`\`\`md\n${navigation}\`\`\`\n`,
    `## 原帖正文\n\n> 来源中的链接\n${navigation}`
  ]) {
    const parsed = parseFrontmatter(`---\n{"id":"Q-0001"}\n---\n${body}`, "example.md");
    assert.equal(parsed.body, body);
  }
});

test("generates stable lowercase detail URLs without changing the original document", () => {
  for (const [id, route] of [
    ["Q-0140", "question/q-0140"],
    ["MJ-XHS-2026-0586", "interview/mj-xhs-2026-0586"],
    ["COL-XL-AGENT", "collection/col-xl-agent"]
  ]) {
    assert.equal(onlineReadingUrl(id), `https://mianstack.com/${route}`);
  }
  assert.throws(() => onlineReadingUrl("../../example"), /No online reading route/);
  for (const newline of ["\n", "\r\n"]) {
    for (const body of ["", `${newline}## 核心回答${newline}${newline}原文。${newline}`]) {
      const metadata = { id: "Q-0001", title: "比较 [A] 和 B\\C", updatedAt: "2026-10-17" };
      const text = `---${newline}${JSON.stringify(metadata, null, 2).replaceAll("\n", newline)}${newline}---${newline}${body}`;
      const updated = withOnlineReadingLink(text);
      assert.deepEqual(parseFrontmatter(updated, "question.md"), { data: metadata, body });
      assert.ok(updated.startsWith(text.slice(0, text.length - body.length)));
      assert.ok(updated.includes("比较 \\[A\\] 和 B\\\\C"));
      assert.equal(withOnlineReadingLink(updated), updated);
      assert.equal(
        stripOnlineReadingLink(updated.slice(updated.indexOf("---", 4) + 3 + newline.length)),
        body
      );
    }
  }
});

test("refreshes generated navigation after a title change without duplicating it", () => {
  const text = '---\n{"id":"Q-0001","title":"旧标题"}\n---\n\n原始答案。\n';
  const original = withOnlineReadingLink(text);
  const renamed = original.replace('"title":"旧标题"', '"title":"新标题"');
  const updated = withOnlineReadingLink(renamed);
  assert.ok(updated.includes("[新标题](https://mianstack.com/question/q-0001)"));
  assert.equal((updated.match(/^> 在面栈阅读：/gm) || []).length, 1);
  assert.ok(!updated.includes("<!--"));
  assert.equal(parseFrontmatter(updated, "question.md").body, "\n原始答案。\n");
});

test("keeps Python dunder names and Markdown punctuation literal in the reading title", () => {
  const title = "Python __new__、*args* 与 `__init__`";
  const text = `---\n${JSON.stringify({ id: "Q-6519", title })}\n---\n`;
  const generated = withOnlineReadingLink(text);
  assert.ok(generated.includes("[Python \\_\\_new\\_\\_、\\*args\\* 与 \\`\\_\\_init\\_\\_\\`]"));
  assert.equal(parseFrontmatter(generated, "question.md").data.title, title);
});

test("keeps a top link to a different question as content", () => {
  const body = navigation.replace("q-0001", "q-0002");
  assert.equal(parseFrontmatter(`---\n{"id":"Q-0001"}\n---\n${body}`, "question.md").body, body);
});

test("updates existing trailing-slash navigation without duplicating it or changing the body", () => {
  const body = "\n## 核心回答\n\n原始答案。\n";
  const oldNavigation = navigation.replace("q-0001)", "q-0001/)");
  const text = `---\n{"id":"Q-0001","title":"示例问题"}\n---\n${oldNavigation}${body}`;
  const updated = withOnlineReadingLink(text);
  assert.equal(updated, text.replace("q-0001/)", "q-0001)"));
  assert.equal(parseFrontmatter(updated, "question.md").body, body);
  assert.equal(parseFrontmatter(text, "question.md").body, body);
  assert.equal(withOnlineReadingLink(updated), updated);
});

test("adds collection reading URLs without reformatting existing JSON content", () => {
  const collection = {
    title: "示例题集",
    id: "COL-DEMO",
    sourceUrl: "https://example.com/source?version=1",
    items: [{ id: "COL-DEMO-001", originalTitle: '保留 "readingUrl" 原文' }]
  };
  for (const original of [
    JSON.stringify(collection),
    JSON.stringify(collection, null, 2) + "\n",
    (JSON.stringify(collection, null, 2) + "\n").replaceAll("\n", "\r\n")
  ]) {
    const updated = withCollectionReadingUrl(original);
    const data = JSON.parse(updated);
    assert.equal(data.readingUrl, "https://mianstack.com/collection/col-demo");
    delete data.readingUrl;
    assert.deepEqual(data, collection);
    assert.equal(withCollectionReadingUrl(updated), updated);
    assert.equal(updated.replace(/(?:\r?\n[ \t]*)?"readingUrl"\s*:\s*"[^"]*",/, ""), original);
  }
});

test("refreshes a stale collection reading URL without replacing the original source URL", () => {
  const original =
    '{"id":"COL-DEMO","readingUrl":"https://mianstack.com/collection/old/","sourceUrl":"https://example.com/source","items":[]}\n';
  const updated = withCollectionReadingUrl(original);
  assert.equal(updated, original.replace("/collection/old/", "/collection/col-demo"));
  assert.equal(withCollectionReadingUrl(updated), updated);
});
