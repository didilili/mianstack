#!/usr/bin/env node

/**
 * 根据统一内容入口生成公开索引，不依赖网站仓库。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent, resolveGeneratedPath } from "./lib/content.mjs";
import {
  onlineReadingUrl,
  withOnlineReadingLink,
  withCollectionReadingUrl
} from "./lib/online-reading.mjs";
import { schemaGroup } from "./lib/schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node scripts/build-indexes.mjs [--check]");
  process.exit(0);
}
const unknownArgs = args.filter((arg) => arg !== "--check");
if (unknownArgs.length) {
  console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  console.error("Usage: node scripts/build-indexes.mjs [--check]");
  process.exit(2);
}
const checkOnly = args.includes("--check");

function markdownText(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function categoryFilename(id) {
  return `${id.replaceAll("_", "-")}.md`;
}

const generatedNotice = "> 本文件由 `npm run build:indexes` 生成，请勿手工修改。";

function navigationLines(entries, { collapsible = false } = {}) {
  const links = entries.map(({ id, label }) => `- [${markdownText(label)}](#${id})`);
  if (!collapsible) return ["## 页内导航", "", ...links, ""];
  return [
    "## 页内导航",
    "",
    "<details>",
    "<summary>展开完整目录</summary>",
    "",
    ...links,
    "",
    "</details>",
    ""
  ];
}

const content = loadContent(root);
const { contentSchema, categories, questions, interviews, publishers, publisherById, collections } =
  content;
const answeredStatuses = new Set(schemaGroup(contentSchema, "answerStatus", "answered"));
const inProgressStatuses = new Set(schemaGroup(contentSchema, "answerStatus", "inProgress"));
const mustReviewPriorities = new Set(schemaGroup(contentSchema, "questionPriority", "mustReview"));
function answerLabel(status) {
  if (answeredStatuses.has(status)) return " · **已有答案**";
  if (inProgressStatuses.has(status)) return " · 答案整理中";
  return "";
}

const readyAnswerCount = questions.filter((question) =>
  answeredStatuses.has(question.answerStatus)
).length;
const outputs = new Map();
const sourcePaths = new Set();
for (const [directory, records] of [
  ["questions", questions],
  ["interviews", interviews]
]) {
  for (const record of records) {
    const relativePath = `${directory}/${record.filename}`;
    const text = fs.readFileSync(resolveGeneratedPath(root, relativePath), "utf8");
    outputs.set(relativePath, withOnlineReadingLink(text, relativePath));
    sourcePaths.add(relativePath);
  }
}
for (const collection of collections) {
  const relativePath = `collections/${collection.filename}`;
  const text = fs.readFileSync(resolveGeneratedPath(root, relativePath), "utf8");
  outputs.set(relativePath, withCollectionReadingUrl(text));
  sourcePaths.add(relativePath);
}
const rootSections = [
  { id: "current-content", label: "当前内容" },
  { id: "recommended-starts", label: "推荐起点" },
  { id: "knowledge-directions", label: "按知识方向浏览" },
  { id: "source-indexes", label: "按来源浏览" },
  { id: "repository-content", label: "仓库内容" },
  { id: "id-conventions", label: "编号说明" }
];

const rootIndex = [
  "# 面栈题库索引",
  "",
  generatedNotice,
  "",
  "面栈面向准备 AI Agent、LLM 应用、RAG、模型训练及相关工程岗位的求职者，是一个可以直接阅读、也欢迎共同完善的面试题库与答案库。题目记录主要考点和答案完成情况，面经与题集保留来源信息；[mianstack.com](https://mianstack.com) 提供搜索、筛选和复习功能。",
  "",
  ...navigationLines(rootSections),
  '<a id="current-content"></a>',
  "## 当前内容",
  "",
  `- ${questions.length.toLocaleString("zh-CN")} 道整理后的面试题`,
  `- ${interviews.length.toLocaleString("zh-CN")} 篇真实面经`,
  `- ${collections.length.toLocaleString("zh-CN")} 份公开题集`,
  `- ${publishers.length.toLocaleString("zh-CN")} 位公开题集发布者`,
  `- ${readyAnswerCount.toLocaleString("zh-CN")} 道参考答案可直接阅读`,
  "",
  "仓库提供题目、公开参考答案和来源材料。题目与来源的关联、前后追问和其他编排可在[面栈网站](https://mianstack.com)阅读。",
  "",
  '<a id="recommended-starts"></a>',
  "## 推荐起点",
  "",
  "- [优先准备的核心题](indexes/priority.md)",
  "- [Agent 面试题](indexes/agent.md)",
  "- [RAG 面试题](indexes/rag.md)",
  "- [真实面经索引](indexes/interviews.md)",
  "",
  '<a id="knowledge-directions"></a>',
  "## 按知识方向浏览",
  "",
  "| 方向 | 题目数 | 专题数 | 入口 |",
  "| --- | ---: | ---: | --- |",
  ...categories.map((category) => {
    const count = questions.filter((question) => question.category === category.id).length;
    return `| ${category.title} | ${count} | ${category.topics.length} | [查看题目](indexes/${categoryFilename(category.id)}) |`;
  }),
  "",
  '<a id="source-indexes"></a>',
  "## 按来源浏览",
  "",
  "- [真实面经索引](indexes/interviews.md)",
  "- [公开题集索引](indexes/collections.md)",
  "- [候选人反问题目](indexes/career.md#候选人反问)",
  "",
  '<a id="repository-content"></a>',
  "## 仓库内容",
  "",
  "| 路径 | 内容 |",
  "| --- | --- |",
  "| [`questions/`](questions/) | 面试题、主要考点和参考答案 |",
  "| [`interviews/`](interviews/) | 面经来源信息与已收录的来源材料 |",
  "| [`collections/`](collections/) | 其他公开题集收录的题目 |",
  "| [`categories.json`](categories.json) | 知识方向与专题 |",
  "| [`aliases.json`](aliases.json) | 已合并稳定题号的一对一指向 |",
  "| [`publishers.json`](publishers.json) | 公开题集发布者和来源主页 |",
  "| [`examples/`](examples/) | 题目和面经的最小示例 |",
  "| [`schema/`](schema/) | 字段和引用约定 |",
  "| [`scripts/`](scripts/) | 内容校验与索引生成脚本 |",
  "| [`tests/`](tests/) | 校验器的回归测试 |",
  "",
  "使用这些数据开发检索、复习工具或阅读网站，见[数据使用说明](USAGE.md)；格式与维护变化见[变更记录](CHANGELOG.md)。",
  "",
  '<a id="id-conventions"></a>',
  "## 编号说明",
  "",
  "- `Q-*`：整理后的面试题。",
  "- `MJ-NC-*`：牛客面经来源记录。",
  "- `MJ-XHS-*`：小红书面经来源记录。",
  "- `COL-*`：公开题集记录。",
  "",
  "面经保留来源前缀，但末尾流水号按年份由所有来源共用。题号、面经编号和题集编号一经使用就不会重新排序或重复使用。来源正文保留已收录的原始问法；题目与来源的对应关系由网站维护。",
  "",
  "继续阅读：[项目介绍](README.md) · [贡献指南](CONTRIBUTING.md) · [字段说明](schema/README.md) · [维护说明](MAINTAINING.md)",
  ""
].join("\n");
outputs.set("INDEX.md", rootIndex);

const priorityQuestions = questions.filter((question) =>
  mustReviewPriorities.has(question.priority)
);
const priorityGroups = categories
  .map((category) => ({
    category,
    items: priorityQuestions.filter((question) => question.category === category.id)
  }))
  .filter(({ items }) => items.length > 0);
const priorityLines = [
  "# 优先准备",
  "",
  generatedNotice,
  "",
  "[返回题库总索引](../INDEX.md) · [在线阅读](https://mianstack.com/must-review)",
  "",
  `这里收录当前标记为“优先准备”的 ${priorityQuestions.length} 道核心题，适合第一次打开仓库或面试临近时先过一遍。`,
  "",
  ...navigationLines(
    priorityGroups.map(({ category }, index) => ({
      id: `category-${index + 1}`,
      label: category.title
    }))
  )
];
for (const [index, { category, items }] of priorityGroups.entries()) {
  priorityLines.push(`<a id="category-${index + 1}"></a>`, `## ${category.title}`, "");
  for (const question of items) {
    priorityLines.push(
      `- [${question.id} ${markdownText(question.title)}](../questions/${question.filename}) · [在线阅读](${onlineReadingUrl(question.id)})${answerLabel(question.answerStatus)}`
    );
  }
  priorityLines.push("");
}
outputs.set("indexes/priority.md", priorityLines.join("\n"));

for (const category of categories) {
  const categoryQuestions = questions.filter((question) => question.category === category.id);
  const topicGroups = category.topics
    .map((topic) => ({
      topic,
      items: categoryQuestions.filter((question) => question.topic === topic)
    }))
    .filter(({ items }) => items.length > 0);
  const lines = [
    `# ${category.title}`,
    "",
    generatedNotice,
    "",
    `[返回题库总索引](../INDEX.md) · [在线阅读](https://mianstack.com/knowledge/${category.id.replaceAll("_", "-")})`,
    "",
    category.description,
    "",
    `共 ${categoryQuestions.length.toLocaleString("zh-CN")} 道题，分为 ${category.topics.length} 个专题。`,
    "",
    ...navigationLines(
      topicGroups.map(({ topic }, index) => ({
        id: `topic-${index + 1}`,
        label: topic
      }))
    )
  ];
  for (const [index, { topic, items }] of topicGroups.entries()) {
    lines.push(`<a id="topic-${index + 1}"></a>`, `## ${topic}`, "");
    for (const question of items) {
      lines.push(
        `- [${question.id} ${markdownText(question.title)}](../questions/${question.filename}) · [在线阅读](${onlineReadingUrl(question.id)})${answerLabel(question.answerStatus)}`
      );
    }
    lines.push("");
  }
  outputs.set(`indexes/${categoryFilename(category.id)}`, lines.join("\n"));
}

const interviewGroups = new Map();
for (const interview of interviews) {
  const company = interview.company || "公司未注明";
  if (!interviewGroups.has(company)) interviewGroups.set(company, []);
  interviewGroups.get(company).push(interview);
}
const sortedInterviewGroups = [...interviewGroups.entries()].sort(
  (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh-CN")
);
const interviewLines = [
  "# 真实面经索引",
  "",
  generatedNotice,
  "",
  "[返回题库总索引](../INDEX.md) · [在线阅读](https://mianstack.com/interview)",
  "",
  `共 ${interviews.length.toLocaleString("zh-CN")} 篇真实面经，按公司分组。选择目标公司，看看同类岗位问过什么、怎样追问，再回到题库准备对应答案。`,
  "",
  ...navigationLines(
    sortedInterviewGroups.map(([company], index) => ({
      id: `company-${index + 1}`,
      label: company
    })),
    { collapsible: true }
  )
];
for (const [index, [company, items]] of sortedInterviewGroups.entries()) {
  interviewLines.push(`<a id="company-${index + 1}"></a>`, `## ${company}（${items.length}）`, "");
  for (const interview of items) {
    const role = [
      ...new Set(
        interview.contexts
          .filter((context) => context.role)
          .map((context) => `${context.role}${context.roleInferred ? "（推测）" : ""}`)
      )
    ].join("、");
    const meta = [
      role,
      interview.jobNature,
      interview.recruitment,
      interview.publishedAt?.slice(0, 10)
    ]
      .filter(Boolean)
      .join(" · ");
    interviewLines.push(
      `- [${interview.id} ${markdownText(interview.title)}](../interviews/${interview.filename}) · [在线阅读](${onlineReadingUrl(interview.id)})${meta ? ` — ${markdownText(meta)}` : ""}`
    );
  }
  interviewLines.push("");
}
outputs.set("indexes/interviews.md", interviewLines.join("\n"));

const collectionLines = [
  "# 公开题集索引",
  "",
  generatedNotice,
  "",
  "[返回题库总索引](../INDEX.md) · [在线阅读](https://mianstack.com/collection)",
  "",
  "这里汇总其他作者和整理者公开发布的面试题集，方便从不同题单继续阅读。题集收录和真实面试出现次数分开统计，第三方来源不会因收录而改用仓库许可证。",
  "",
  ...navigationLines(
    collections.map((collection, index) => ({
      id: `collection-${index + 1}`,
      label: collection.title
    }))
  )
];
for (const [index, collection] of collections.entries()) {
  const publisher = publisherById.get(collection.publisherId);
  collectionLines.push(
    `<a id="collection-${index + 1}"></a>`,
    `## ${markdownText(collection.title)}`,
    "",
    `- 发布者：${markdownText(publisher.name)}`,
    `- 收录数量：${collection.items.length}`,
    `- [在线阅读](${onlineReadingUrl(collection.id)})`,
    `- [仓库记录](../collections/${collection.filename})`,
    `- [原始来源](${collection.sourceUrl})`,
    ""
  );
}
outputs.set("indexes/collections.md", collectionLines.join("\n"));

const outdated = [];
for (const [relativePath, content] of outputs) {
  const target = resolveGeneratedPath(root, relativePath);
  const normalized = sourcePaths.has(relativePath) ? content : `${content.trimEnd()}\n`;
  if (checkOnly) {
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== normalized)
      outdated.push(relativePath);
    continue;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== normalized) {
    const temporary = `${target}.tmp-${process.pid}`;
    try {
      fs.writeFileSync(temporary, normalized, { flag: "wx" });
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    console.log(`updated ${relativePath}`);
  }
}

const expectedIndexes = new Set(
  [...outputs.keys()].filter((relativePath) => relativePath.startsWith("indexes/"))
);
const indexDirectory = resolveGeneratedPath(root, "indexes");
if (fs.existsSync(indexDirectory)) {
  for (const entry of fs.readdirSync(indexDirectory, {
    withFileTypes: true
  })) {
    const relativePath = `indexes/${entry.name}`;
    if (!entry.isFile() || !entry.name.endsWith(".md") || expectedIndexes.has(relativePath))
      continue;
    const target = resolveGeneratedPath(root, relativePath);
    if (!checkOnly && fs.readFileSync(target, "utf8").includes(generatedNotice)) {
      fs.unlinkSync(target);
      console.log(`removed ${relativePath}`);
    } else outdated.push(`${relativePath} (unexpected file)`);
  }
}

if (outdated.length) {
  console.error(`Outdated generated indexes:\n${outdated.map((item) => `- ${item}`).join("\n")}`);
  console.error("Run: npm run build:indexes");
  process.exit(1);
}

if (checkOnly) console.log(`Indexes and online reading links are current (${outputs.size} files).`);
