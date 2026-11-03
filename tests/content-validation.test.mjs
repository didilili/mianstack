import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadContent, parseFrontmatter, resolveGeneratedPath } from "../scripts/lib/content.mjs";
import {
  createContentSchemaValidators,
  loadContentSchema,
  schemaErrors
} from "../scripts/lib/schema.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories = new Set();

function temporaryDirectory(prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.add(directory);
  return directory;
}

test.after(() => {
  for (const directory of temporaryDirectories)
    fs.rmSync(directory, { recursive: true, force: true });
});

function question(overrides = {}) {
  return {
    id: "Q-0001",
    title: "示例问题",
    category: "agent",
    topic: "Agent 基础",
    type: "概念解释",
    level: "基础",
    priority: "按岗位选读",
    focus: "验证内容结构。",
    answerStatus: "pending",
    updatedAt: "2026-09-22",
    ...overrides
  };
}

function interview(overrides = {}) {
  return {
    id: "MJ-NC-2026-0001",
    title: "示例面经",
    originalTitle: "示例面经",
    contexts: [
      {
        company: "示例公司",
        roleFamily: "前端开发",
        role: "示例岗位",
        roleMethod: "原文明示",
        roleDirections: ["AI Coding 与研发工具"]
      }
    ],
    publishedAt: "2026-09-22 10:00:00",
    author: "示例作者",
    url: "https://example.com/interview",
    contentType: "面经",
    sourceStatus: "完整可用",
    curationStatus: "已完成",
    curationNote: "",
    updatedAt: "2026-09-22",
    ...overrides
  };
}

function markdown(metadata, body = "") {
  return `---\n${JSON.stringify(metadata, null, 2)}\n---\n${body}`;
}

const currentInterviewBody = "## 原帖正文\n\n> 正文\n";

test("requires the canonical missing-company name without discarding context facts", () => {
  for (const company of ["未知公司", "未披露", "其他"]) {
    const root = createFixture();
    fs.writeFileSync(
      path.join(root, "interviews/MJ-NC-2026-0001.md"),
      markdown(
        interview({ contexts: [{ ...interview().contexts[0], company }] }),
        currentInterviewBody
      )
    );
    assert.throws(() => loadContent(root), /company must use 公司未注明/);
  }
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(
      interview({
        contexts: [
          { ...interview().contexts[0], company: "公司未注明", base: "深圳", business: "教育" }
        ]
      }),
      currentInterviewBody
    )
  );
  const context = loadContent(root).interviews[0].contexts[0];
  assert.equal(context.company, "公司未注明");
  assert.equal(context.base, "深圳");
  assert.equal(context.business, "教育");
});

test("accepts optional author profiles without requiring them on existing interviews", () => {
  const validators = createContentSchemaValidators(loadContentSchema(repositoryRoot));
  assert.deepEqual(schemaErrors(validators.interview, interview(), "interview"), []);
  assert.deepEqual(
    schemaErrors(
      validators.interview,
      interview({ authorUrl: "https://www.nowcoder.com/users/123456" }),
      "interview"
    ),
    []
  );
  for (const authorUrl of ["", "not-a-url", "javascript:alert(1)"])
    assert.ok(
      schemaErrors(validators.interview, interview({ authorUrl }), "interview").some((message) =>
        message.includes("authorUrl")
      )
    );
});

const interviewSummaryFields = [
  "company",
  "business",
  "role",
  "roleFamilies",
  "roleDirections",
  "jobNature",
  "recruitment",
  "batches",
  "rounds",
  "base"
];

function withoutInterviewSummaries(metadata) {
  const result = { ...metadata };
  for (const field of interviewSummaryFields) delete result[field];
  return result;
}

test("keeps primary role functions separate from normalized role directions", () => {
  const schema = loadContentSchema(repositoryRoot);
  assert.deepEqual(schema.$defs.roleFamily.enum, [
    "AI 应用与智能体工程",
    "AI 系统与基础设施",
    "算法与模型研发",
    "后端开发",
    "前端开发",
    "全栈开发",
    "客户端开发",
    "通用软件开发",
    "嵌入式与系统软件",
    "平台与基础设施开发",
    "运维与研发效能",
    "安全工程",
    "测试与质量",
    "数据工程",
    "数据分析与科学",
    "硬件与芯片",
    "产品",
    "运营",
    "解决方案与交付"
  ]);
  assert.deepEqual(schema.$defs.roleDirection.enum, [
    "AI 应用与 Agent",
    "大模型与生成式 AI",
    "AI Coding 与研发工具",
    "AI 评测与治理",
    "训练推理与 AI 系统",
    "搜索推荐与广告",
    "视觉与多模态",
    "NLP 与语音",
    "数据与知识工程",
    "云平台与分布式系统",
    "安全风控与隐私",
    "自动驾驶与机器人",
    "游戏图形与音视频",
    "金融科技"
  ]);
});

function writeJson(root, relativePath, value) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture() {
  const root = temporaryDirectory("mianstack-content-test-");
  for (const directory of ["questions", "interviews", "collections", "schema"])
    fs.mkdirSync(path.join(root, directory), { recursive: true });

  fs.copyFileSync(
    path.join(repositoryRoot, "schema/content.schema.json"),
    path.join(root, "schema/content.schema.json")
  );

  fs.writeFileSync(path.join(root, "questions/Q-0001.md"), markdown(question()));
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview(), currentInterviewBody)
  );
  writeJson(root, "categories.json", [
    {
      id: "agent",
      title: "Agent",
      description: "Agent 分类",
      topics: ["Agent 基础"]
    }
  ]);
  writeJson(root, "aliases.json", []);
  writeJson(root, "publishers.json", []);
  return root;
}

test("parses JSON frontmatter with LF and CRLF line endings", () => {
  const lf = markdown(question());
  const crlf = lf.replaceAll("\n", "\r\n");

  assert.equal(parseFrontmatter(lf, "question.md").data.id, "Q-0001");
  assert.equal(parseFrontmatter(crlf, "question.md").data.id, "Q-0001");
});

test("rejects whitespace-only required content strings", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "questions/Q-0001.md"),
    markdown(question({ title: " \t\n", focus: "　 " }))
  );
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ author: "   " }), currentInterviewBody)
  );

  assert.throws(
    () => loadContent(root),
    (error) => {
      for (const field of ["title", "focus", "author"])
        assert.match(error.message, new RegExp(`${field} must not be blank`));
      return true;
    }
  );
});

for (const prefix of ["NC", "XHS"]) {
  test(`validates source sections and empty original bodies for ${prefix} interviews`, () => {
    const root = createFixture();
    const id = `MJ-${prefix}-2026-0001`;
    const sourcePath = path.join(root, `interviews/${id}.md`);
    if (prefix !== "NC") {
      fs.unlinkSync(path.join(root, "interviews/MJ-NC-2026-0001.md"));
    }

    for (const body of ["## 原帖正文\n", "## 原帖正文\n\n> \n> \t\n"])
      for (const sourceStatus of ["完整可用", "部分可用"]) {
        fs.writeFileSync(sourcePath, markdown(interview({ id, sourceStatus }), body));
        assert.throws(() => loadContent(root), /available source requires nonempty original body/);
      }

    fs.writeFileSync(sourcePath, markdown(interview({ id }), "> 缺少来源章节\n"));
    assert.throws(() => loadContent(root), /body must contain exactly one ## 原帖正文 section/);

    fs.writeFileSync(
      sourcePath,
      markdown(interview({ id }), `${currentInterviewBody}\n## 图片\n\n- 图片\n`)
    );
    assert.throws(() => loadContent(root), /body must not contain a ## 图片 section/);

    const unavailable = interview({
      id,
      sourceStatus: "不可用",
      statusReason: "原帖已删除",
      curationNote: "原帖已删除，未能取得原始正文。"
    });
    fs.writeFileSync(sourcePath, markdown(unavailable, "## 原帖正文\n"));
    assert.doesNotThrow(() => loadContent(root));
    fs.writeFileSync(sourcePath, markdown({ ...unavailable, curationNote: "" }, "## 原帖正文\n"));
    assert.throws(
      () => loadContent(root),
      /empty original body requires statusReason and curationNote/
    );
  });
}

test("records source check dates independently of content updates", () => {
  const root = createFixture();
  const sourcePath = path.join(root, "interviews/MJ-NC-2026-0001.md");
  fs.writeFileSync(
    sourcePath,
    markdown(interview({ lastCheckedAt: "2026-09-20" }), currentInterviewBody)
  );
  const loaded = loadContent(root).interviews[0];
  assert.equal(loaded.lastCheckedAt, "2026-09-20");
  assert.equal(loaded.updatedAt, "2026-09-22");
  fs.writeFileSync(sourcePath, markdown(interview(), currentInterviewBody));
  assert.equal(loadContent(root).interviews[0].lastCheckedAt, "");
  for (const lastCheckedAt of ["", "2026-02-30"]) {
    fs.writeFileSync(sourcePath, markdown(interview({ lastCheckedAt }), currentInterviewBody));
    assert.throws(() => loadContent(root), /lastCheckedAt has invalid date/);
  }
});

test("reports the file when JSON frontmatter is invalid", () => {
  assert.throws(
    () => parseFrontmatter("---\n{invalid}\n---\n", "questions/Q-0001.md"),
    /questions\/Q-0001\.md: invalid JSON frontmatter/
  );
});

test("reports non-object Markdown frontmatter instead of crashing", () => {
  const root = createFixture();
  fs.writeFileSync(path.join(root, "questions/Q-0001.md"), markdown(null));

  assert.throws(() => loadContent(root), /questions\/Q-0001\.md: record must be object/);
});

test("keeps generated output inside the repository and rejects traversal", () => {
  const root = "/tmp/mianstack";

  assert.equal(resolveGeneratedPath(root, "indexes/agent.md"), "/tmp/mianstack/indexes/agent.md");
  assert.throws(
    () => resolveGeneratedPath(root, "indexes/../../mianstack-web/README.md"),
    /outside repository/
  );
});

test("rejects generated output through a symbolic-link directory", () => {
  const root = temporaryDirectory("mianstack-output-test-");
  const outside = temporaryDirectory("mianstack-output-outside-");
  fs.symlinkSync(outside, path.join(root, "indexes"));

  assert.throws(() => resolveGeneratedPath(root, "indexes/agent.md"), /symbolic link/);
});

test("loads and validates the complete current repository", () => {
  const content = loadContent(repositoryRoot);

  assert.ok(content.questions.length > 0);
  assert.ok(content.interviews.length > 0);
  assert.equal(Object.hasOwn(content, "relationships"), false);
  assert.equal(content.questionById.size, content.questions.length);
});

test("keeps migration-only artifacts out of the public repository", () => {
  assert.equal(fs.existsSync(path.join(repositoryRoot, "archive")), false);

  const schemaSource = fs.readFileSync(
    path.join(repositoryRoot, "schema/content.schema.json"),
    "utf8"
  );
  const loaderSource = fs.readFileSync(
    path.join(repositoryRoot, "scripts/lib/content.mjs"),
    "utf8"
  );
  assert.doesNotMatch(
    schemaSource,
    /legacyQuestion|migrationReport|sourceMappingSha256|sourceMetadataSha256/
  );
  assert.doesNotMatch(loaderSource, /legacyQuestionMap|migrationReport|migrationArchiveDirectory/);
});

test("allows only the fixed README guide in each content directory", () => {
  const root = createFixture();
  for (const directory of ["questions", "interviews", "collections"])
    fs.writeFileSync(path.join(root, directory, "README.md"), "# 目录说明\n");

  assert.doesNotThrow(() => loadContent(root));

  fs.writeFileSync(path.join(root, "questions/GUIDE.md"), "# 额外说明\n");
  assert.throws(() => loadContent(root), /questions\/GUIDE\.md/);
});

test("keeps every generated index self-identifying and navigable", () => {
  const generatedPaths = [
    "INDEX.md",
    ...fs
      .readdirSync(path.join(repositoryRoot, "indexes"))
      .filter((filename) => filename.endsWith(".md"))
      .map((filename) => `indexes/${filename}`)
  ];

  assert.equal(generatedPaths.length, 12);
  for (const relativePath of generatedPaths) {
    const text = fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    assert.match(text, /> 本文件由 `npm run build:indexes` 生成，请勿手工修改。/, relativePath);
    assert.match(text, /## 页内导航/, relativePath);
  }

  const softwareIndex = fs.readFileSync(path.join(repositoryRoot, "indexes/software.md"), "utf8");
  assert.match(softwareIndex, /\[Java、Spring 与 JVM\]\(#topic-\d+\)/);
  assert.match(softwareIndex, /<a id="topic-\d+"><\/a>\n## Java、Spring 与 JVM/);
});

test("keeps public examples aligned with the canonical schema", () => {
  const examplePaths = ["examples/question.example.md", "examples/interview.example.md"];
  for (const relativePath of examplePaths)
    assert.equal(
      fs.existsSync(path.join(repositoryRoot, relativePath)),
      true,
      `${relativePath} is missing`
    );

  const schema = loadContentSchema(repositoryRoot);
  const validators = createContentSchemaValidators(schema);
  const questionExample = parseFrontmatter(
    fs.readFileSync(path.join(repositoryRoot, examplePaths[0]), "utf8"),
    examplePaths[0]
  ).data;
  const interviewExample = parseFrontmatter(
    fs.readFileSync(path.join(repositoryRoot, examplePaths[1]), "utf8"),
    examplePaths[1]
  ).data;

  assert.deepEqual(schemaErrors(validators.question, questionExample, "question"), []);
  assert.deepEqual(schemaErrors(validators.interview, interviewExample, "interview"), []);
});

test("normalizes sparse public question metadata without private graph fields", () => {
  const root = createFixture();
  const loadedQuestion = loadContent(root).questionById.get("Q-0001");
  assert.equal(loadedQuestion.note, "");
  assert.deepEqual(loadedQuestion.aliases, []);
  assert.deepEqual(loadedQuestion.formatTags, []);
  assert.deepEqual(loadedQuestion.contextTags, []);
  for (const field of ["relations", "familyId", "roleFamilies"])
    assert.equal(Object.hasOwn(loadedQuestion, field), false);
});

test("requires optional question fields to carry meaningful values when present", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "questions/Q-0001.md"),
    markdown(
      question({
        note: "",
        aliases: [],
        formatTags: [],
        contextTags: []
      })
    )
  );

  assert.throws(
    () => loadContent(root),
    /note must not be empty[\s\S]*aliases must contain at least 1 item[\s\S]*formatTags must contain at least 1 item[\s\S]*contextTags must contain at least 1 item/
  );
});

test("rejects derived fields stored redundantly in question records", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "questions/Q-0001.md"),
    markdown(question({ roleFamilies: ["前端开发"] }))
  );
  assert.throws(() => loadContent(root), /questions\/Q-0001\.md: roleFamilies is not allowed/);
});

test("rejects an invalid content filename instead of silently ignoring it", () => {
  const root = createFixture();
  fs.writeFileSync(path.join(root, "questions/Q-1.md"), markdown(question({ id: "Q-1" })));

  assert.throws(() => loadContent(root), /questions\/Q-1\.md: id has invalid format/);
});

test("accepts documented NC and XHS interview namespaces only", () => {
  const root = createFixture();
  const xhsId = "MJ-XHS-2026-0002";
  fs.writeFileSync(
    path.join(root, `interviews/${xhsId}.md`),
    markdown(
      interview({ id: xhsId, url: "https://www.xiaohongshu.com/explore/demo" }),
      currentInterviewBody
    )
  );

  assert.doesNotThrow(() => loadContent(root));

  fs.writeFileSync(
    path.join(root, "interviews/MJ-XX-2026-0002.md"),
    markdown(interview({ id: "MJ-XX-2026-0002" }), currentInterviewBody)
  );

  assert.throws(() => loadContent(root), /interviews\/MJ-XX-2026-0002\.md: id has invalid format/);
});

test("rejects duplicate interview serials across source namespaces", () => {
  const root = createFixture();
  const xhsId = "MJ-XHS-2026-0001";
  fs.writeFileSync(
    path.join(root, `interviews/${xhsId}.md`),
    markdown(
      interview({ id: xhsId, url: "https://www.xiaohongshu.com/explore/demo" }),
      currentInterviewBody
    )
  );

  assert.throws(
    () => loadContent(root),
    /duplicate interview serial 2026-0001: MJ-NC-2026-0001 and MJ-XHS-2026-0001/
  );
});

test("accepts coherent normalized interview metadata", () => {
  const root = createFixture();

  assert.doesNotThrow(() => loadContent(root));
});

test("requires the unified reader-facing sections in NC interview bodies", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview(), "#### 全文原文（原文）\n\n> 正文\n")
  );
  assert.throws(
    () => loadContent(root),
    /interview MJ-NC-2026-0001: body must contain exactly one ## 原帖正文 section/
  );

  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview(), "## 原帖正文\n\n> 正文\n\n## 图片\n\n- 原帖图片链接\n")
  );
  assert.throws(
    () => loadContent(root),
    /interview MJ-NC-2026-0001: body must not contain a ## 图片 section/
  );

  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview(), "## 原帖正文\n\n> 正文\n\n## 有价值评论\n\n- 页面暂无评论。\n")
  );
  assert.throws(
    () => loadContent(root),
    /interview MJ-NC-2026-0001: optional source sections must contain reader-useful material instead of collection placeholders/
  );
});

test("rejects archived interview image files", () => {
  const root = createFixture();
  fs.mkdirSync(path.join(root, "assets/interviews/MJ-NC-2026-0001"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "assets/interviews/MJ-NC-2026-0001/image-01.png"),
    "not-a-real-image"
  );

  assert.throws(
    () => loadContent(root),
    /interview source images must not be archived under assets\/interviews/
  );
});

test("requires fixed interview metadata values and rejects legacy field names", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(
      interview({
        contentType: "随手记录",
        sourceStatus: "大概可用",
        curationStatus: "差不多完成",
        statusReason: "未知原因",
        material: "面经"
      }),
      "正文"
    )
  );

  assert.throws(
    () => loadContent(root),
    /material is not allowed[\s\S]*contentType must be one of[\s\S]*sourceStatus must be one of[\s\S]*statusReason must be one of[\s\S]*curationStatus must be one of/
  );
});

test("rejects question values outside the shared controlled vocabulary", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "questions/Q-0001.md"),
    markdown(
      question({
        type: "临时类型",
        level: "高级",
        priority: "有空再看",
        formatTags: ["随手记录"],
        contextTags: ["未知场景"]
      })
    )
  );

  assert.throws(
    () => loadContent(root),
    /type must be one of[\s\S]*level must be one of[\s\S]*priority must be one of[\s\S]*formatTags[\s\S]*contextTags/
  );
});

test("rejects interview context values outside the shared controlled vocabulary", () => {
  const root = createFixture();
  const invalidContext = {
    ...interview().contexts[0],
    roleFamily: "无法判断",
    roleMethod: "根据感觉判断",
    roleConfidence: "比较高",
    jobNature: "校园招聘",
    recruitment: "内部推荐",
    stages: ["AI面"]
  };
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(
      interview({
        contexts: [invalidContext]
      }),
      "正文"
    )
  );

  assert.throws(
    () => loadContent(root),
    /roleFamily must be one of[\s\S]*roleMethod must be one of[\s\S]*roleConfidence must be one of[\s\S]*jobNature must be one of[\s\S]*recruitment must be one of[\s\S]*stages/
  );
});

test("accepts a role directly supported by source responsibilities", () => {
  const root = createFixture();
  const supportedContext = {
    ...interview().contexts[0],
    roleMethod: "职责支持"
  };
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ contexts: [supportedContext] }), currentInterviewBody)
  );

  assert.doesNotThrow(() => loadContent(root));
});

test("normalizes sparse interview metadata without sharing mutable defaults", () => {
  const root = createFixture();
  const metadata = interview();
  for (const field of ["publishedAt", "publicationRegion", "result", "statusReason"])
    delete metadata[field];
  const strings = [
    "business",
    "department",
    "roleFamily",
    "roleConfidence",
    "jobNature",
    "recruitment",
    "base"
  ];
  const arrays = ["roleDirections", "technicalDirections", "batches", "rounds", "stages"];
  for (const field of [...strings, ...arrays]) delete metadata.contexts[0][field];
  metadata.contexts.push({ ...metadata.contexts[0] });
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(metadata, currentInterviewBody)
  );
  const loaded = loadContent(root).interviews[0];
  for (const field of ["publishedAt", "publicationRegion", "result", "statusReason"])
    assert.equal(loaded[field], "");
  for (const field of strings) assert.equal(loaded.contexts[0][field], "");
  for (const field of arrays) {
    assert.deepEqual(loaded.contexts[0][field], []);
    assert.notEqual(loaded.contexts[0][field], loaded.contexts[1][field]);
  }
});

test("rejects empty optional interview metadata when present", () => {
  const root = createFixture();
  const metadata = interview();
  const top = ["publishedAt", "publicationRegion", "result", "statusReason"];
  const strings = [
    "business",
    "department",
    "roleFamily",
    "roleConfidence",
    "jobNature",
    "recruitment",
    "base"
  ];
  const arrays = ["roleDirections", "technicalDirections", "batches", "rounds", "stages"];
  for (const field of top) metadata[field] = "";
  for (const field of strings) metadata.contexts[0][field] = "";
  for (const field of arrays) metadata.contexts[0][field] = [];
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(metadata, currentInterviewBody)
  );
  assert.throws(
    () => loadContent(root),
    (error) => {
      for (const field of [...top, ...strings, ...arrays])
        assert.match(
          error.message,
          new RegExp(
            `${field} (?:must not be empty|must contain at least|has invalid|must be one of)`
          )
        );
      return true;
    }
  );
});

test("derives role inference flags from canonical role methods", () => {
  for (const [roleMethod, roleConfidence, expected] of [
    ["原文明示", "", false],
    ["职责支持", "", false],
    ["资料不足", "不可判定", false],
    ["面试内容推测", "高", true],
    ["标题与索引推断", "中", true],
    ["职责推断", "低", true]
  ]) {
    const root = createFixture();
    const context = { ...interview().contexts[0], roleMethod, roleConfidence };
    if (roleMethod === "资料不足") {
      context.role = "";
      delete context.roleFamily;
    }
    if (roleConfidence === "") delete context.roleConfidence;
    delete context.roleInferred;
    fs.writeFileSync(
      path.join(root, "interviews/MJ-NC-2026-0001.md"),
      markdown(interview({ contexts: [context] }), currentInterviewBody)
    );
    assert.equal(loadContent(root).interviews[0].contexts[0].roleInferred, expected, roleMethod);
  }
});

test("distinguishes insufficient role evidence from an explicitly named broad role", () => {
  const root = createFixture();
  const context = {
    company: "示例公司",
    role: "",
    roleMethod: "资料不足",
    roleConfidence: "不可判定",
    roleDirections: ["AI 应用与 Agent"]
  };
  const source = path.join(root, "interviews/MJ-NC-2026-0001.md");
  fs.writeFileSync(source, markdown(interview({ contexts: [context] }), currentInterviewBody));

  const unknown = loadContent(root).interviews[0].contexts[0];
  assert.equal(unknown.role, "");
  assert.equal(unknown.roleFamily, "");
  assert.equal(unknown.roleInferred, false);
  assert.deepEqual(unknown.roleDirections, ["AI 应用与 Agent"]);

  const named = { ...context, role: "AI 研发工程师", roleMethod: "原文明示" };
  delete named.roleConfidence;
  fs.writeFileSync(source, markdown(interview({ contexts: [named] }), currentInterviewBody));
  assert.equal(loadContent(root).interviews[0].contexts[0].role, "AI 研发工程师");
});

test("shared schema rejects nonempty roles when role evidence is insufficient", () => {
  const root = createFixture();
  const validators = createContentSchemaValidators(loadContentSchema(root));
  for (const role of ["未明确岗位", "AI 研发工程师", " \t"]) {
    const context = {
      company: "示例公司",
      role,
      roleMethod: "资料不足",
      roleConfidence: "不可判定"
    };
    const metadata = interview({ contexts: [context] });
    assert.ok(
      schemaErrors(validators.interview, metadata, "interview").some((message) =>
        message.includes("contexts[0].role ")
      ),
      `insufficient evidence must reject role ${JSON.stringify(role)}`
    );
    fs.writeFileSync(
      path.join(root, "interviews/MJ-NC-2026-0001.md"),
      markdown(metadata, currentInterviewBody)
    );
    assert.throws(() => loadContent(root), /contexts\[0\]\.role /);
  }
});

test("shared schema rejects a primary function when role evidence is insufficient", () => {
  const root = createFixture();
  const validators = createContentSchemaValidators(loadContentSchema(root));
  const context = {
    company: "示例公司",
    role: "",
    roleFamily: "前端开发",
    roleMethod: "资料不足",
    roleConfidence: "不可判定"
  };
  const metadata = interview({ contexts: [context] });
  assert.ok(schemaErrors(validators.interview, metadata, "interview").length > 0);
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(metadata, currentInterviewBody)
  );
  assert.throws(() => loadContent(root), /contexts\[0\]/);
});

test("requires a confidence for inferred role methods", () => {
  const root = createFixture();
  const inconsistentContext = {
    ...interview().contexts[0],
    roleMethod: "职责推断",
    roleConfidence: ""
  };
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ contexts: [inconsistentContext] }), currentInterviewBody)
  );

  assert.throws(() => loadContent(root), /roleConfidence is required for an inferred role/);
});

test("rejects unavailable confidence for an inferred role", () => {
  const root = createFixture();
  const inconsistentContext = {
    ...interview().contexts[0],
    roleMethod: "职责推断",
    roleConfidence: "不可判定"
  };
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ contexts: [inconsistentContext] }), currentInterviewBody)
  );

  assert.throws(
    () => loadContent(root),
    /roleConfidence must be 高, 中 or 低 for an inferred role/
  );
});

test("rejects a stored derived role inference flag", () => {
  const root = createFixture();
  const inconsistentContext = {
    ...interview().contexts[0],
    roleMethod: "原文明示",
    roleInferred: true,
    roleConfidence: "高"
  };
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ contexts: [inconsistentContext] }), currentInterviewBody)
  );

  assert.throws(() => loadContent(root), /roleInferred is not allowed/);
});

test("requires insufficient role evidence to use unavailable confidence", () => {
  const root = createFixture();
  const unavailableContext = {
    ...interview().contexts[0],
    role: "",
    roleMethod: "资料不足",
    roleConfidence: ""
  };
  delete unavailableContext.roleFamily;
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ contexts: [unavailableContext] }), currentInterviewBody)
  );

  assert.throws(
    () => loadContent(root),
    /roleConfidence must be 不可判定 when roleMethod is 资料不足/
  );
});

test("derives top-level interview summaries from contexts omitted from frontmatter", () => {
  const root = createFixture();
  const firstContext = {
    ...interview().contexts[0],
    business: "Agent 平台",
    jobNature: "实习",
    recruitment: "校招",
    batches: ["暑期实习"],
    rounds: ["一面"],
    base: "北京"
  };
  const secondContext = {
    ...interview().contexts[0],
    company: "另一家公司",
    business: "模型平台",
    roleFamily: "算法与模型研发",
    role: "算法工程师",
    roleDirections: ["大模型与生成式 AI", "AI Coding 与研发工具"],
    jobNature: "全职",
    recruitment: "社招",
    batches: ["正式批"],
    rounds: ["二面"],
    base: "上海"
  };
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(
      withoutInterviewSummaries(interview({ contexts: [firstContext, secondContext] })),
      currentInterviewBody
    )
  );

  const loaded = loadContent(root).interviews[0];
  assert.deepEqual(
    Object.fromEntries(interviewSummaryFields.map((field) => [field, loaded[field]])),
    {
      company: "示例公司、另一家公司",
      business: "Agent 平台；模型平台",
      role: "示例岗位、算法工程师",
      roleFamilies: ["前端开发", "算法与模型研发"],
      roleDirections: ["AI Coding 与研发工具", "大模型与生成式 AI"],
      jobNature: "实习、全职",
      recruitment: "校招、社招",
      batches: ["暑期实习", "正式批"],
      rounds: ["一面", "二面"],
      base: "北京、上海"
    }
  );
});

test("rejects persisted interview summary fields", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ company: "示例公司" }), currentInterviewBody)
  );

  assert.throws(
    () => loadContent(root),
    /interviews\/MJ-NC-2026-0001\.md: derived interview summary field company must not be stored/
  );
});

test("reports a non-object interview context instead of crashing", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ contexts: [null] }), currentInterviewBody)
  );

  assert.throws(() => loadContent(root), /contexts\[0\] must be object/);
});

test("reports a non-array interview contexts value instead of crashing", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(interview({ contexts: {} }), currentInterviewBody)
  );

  assert.throws(() => loadContent(root), /contexts must be array/);
});

test("reports non-object public semantic records instead of crashing", () => {
  for (const [relativePath, value, expected] of [
    ["categories.json", [null], /category \(unknown\): record must be object/],
    ["publishers.json", [null], /publisher \(unknown\): record must be object/],
    ["collections/COL-DEMO.json", { id: "COL-DEMO", items: [null] }, /items\[0\] must be object/]
  ]) {
    const root = createFixture();
    writeJson(root, relativePath, value);
    assert.throws(() => loadContent(root), expected);
  }
});

test("rejects traversal-shaped category ids", () => {
  const root = createFixture();
  writeJson(root, "categories.json", [
    {
      id: "../../mianstack-web/README",
      title: "Unsafe",
      description: "Unsafe",
      topics: ["Agent 基础"]
    }
  ]);

  assert.throws(() => loadContent(root), /category .*: id has invalid format/);
});

test("rejects category ids reserved by generated indexes", () => {
  const root = createFixture();
  writeJson(root, "categories.json", [
    {
      id: "priority",
      title: "Priority",
      description: "Reserved output name",
      topics: ["Agent 基础"]
    }
  ]);

  assert.throws(() => loadContent(root), /category priority: id is reserved/);
});

test("keeps private relationship fields out of public Markdown metadata", () => {
  for (const field of [
    "sources",
    "sourceIds",
    "primarySourceIds",
    "sourceCount",
    "occurrences",
    "unresolved",
    "familyId"
  ]) {
    const root = createFixture();
    fs.writeFileSync(path.join(root, "questions/Q-0001.md"), markdown(question({ [field]: [] })));
    assert.throws(() => loadContent(root), new RegExp(`${field} is not allowed`));
  }
});

test("validates optional strings and string arrays used by the website loader", () => {
  const root = createFixture();
  fs.writeFileSync(
    path.join(root, "questions/Q-0001.md"),
    markdown(question({ aliases: ["同问", "同问"], note: 42 }))
  );
  fs.writeFileSync(
    path.join(root, "interviews/MJ-NC-2026-0001.md"),
    markdown(
      interview({
        contexts: [
          {
            ...interview().contexts[0],
            roleDirections: ["AI Coding 与研发工具", 42]
          }
        ]
      }),
      currentInterviewBody
    )
  );

  assert.throws(
    () => loadContent(root),
    /questions\/Q-0001\.md: note must be string[\s\S]*aliases must not contain duplicates[\s\S]*interviews\/MJ-NC-2026-0001\.md: contexts\[0\]\.roleDirections\[1\] must be string/
  );
});

test("rejects an invalid top-level JSON shape with a useful error", () => {
  const root = createFixture();
  writeJson(root, "categories.json", { id: "agent" });

  assert.throws(() => loadContent(root), /categories\.json: expected an array/);
});

test("validates alias targets without private mapping files", () => {
  const root = createFixture();
  writeJson(root, "aliases.json", [{ from: "Q-0002", to: "Q-9999", reason: "无效目标" }]);
  assert.throws(() => loadContent(root), /alias target is unknown: Q-9999/);
});

test("validates publisher and collection enums", () => {
  const root = createFixture();
  writeJson(root, "publishers.json", [
    {
      id: "PUB-DEMO",
      name: "示例发布者",
      type: "unknown_type",
      homepage: "https://example.com",
      updatedAt: "2026-09-22"
    }
  ]);
  writeJson(root, "collections/COL-DEMO.json", {
    id: "COL-DEMO",
    publisherId: "PUB-DEMO",
    title: "示例题集",
    sourceUrl: "https://example.com/collection",
    sourceKind: "unknown_kind",
    access: "unknown_access",
    capturedAt: "2026-09-22",
    lastCheckedAt: "2026-09-22",
    verification: "unknown_verification",
    sourceClaim: "示例",
    items: []
  });

  assert.throws(
    () => loadContent(root),
    /sourceKind must be one of[\s\S]*access must be one of[\s\S]*verification must be one of[\s\S]*type must be one of/
  );
});

test("rejects stored collection positions and invalid declared source counts", () => {
  const root = createFixture();
  writeJson(root, "publishers.json", [
    {
      id: "PUB-DEMO",
      name: "示例发布者",
      type: "individual",
      homepage: "https://example.com",
      updatedAt: "2026-09-22"
    }
  ]);
  writeJson(root, "collections/COL-DEMO.json", {
    id: "COL-DEMO",
    publisherId: "PUB-DEMO",
    title: "示例题集",
    sourceUrl: "https://example.com/collection",
    sourceKind: "curated_question_set",
    access: "public",
    declaredItemCount: -1,
    capturedAt: "2026-09-22",
    lastCheckedAt: "2026-09-22",
    verification: "verified_source",
    sourceClaim: "示例",
    items: [
      {
        id: "COL-DEMO-001",
        position: 2,
        originalTitle: "示例问题",
        sourceUrl: "https://example.com/question",
        reviewStatus: "confirmed"
      }
    ]
  });

  assert.throws(
    () => loadContent(root),
    /position is not allowed[\s\S]*declaredItemCount must be at least 0|declaredItemCount must be at least 0[\s\S]*position is not allowed/
  );
});

test("collection coverage references existing knowledge categories", () => {
  const root = createFixture();
  writeJson(root, "publishers.json", [
    { id: "PUB-DEMO", name: "示例作者", type: "individual_brand", updatedAt: "2026-10-20" }
  ]);
  const collection = {
    id: "COL-DEMO",
    publisherId: "PUB-DEMO",
    title: "示例题集",
    sourceUrl: "https://example.com/collection",
    sourceKind: "curated_question_set",
    access: "public",
    capturedAt: "2026-10-20",
    lastCheckedAt: "2026-10-20",
    verification: "verified_source",
    sourceClaim: "示例",
    coverage: ["agent"],
    items: []
  };
  writeJson(root, "collections/COL-DEMO.json", collection);
  assert.deepEqual(loadContent(root).collections[0].coverage, ["agent"]);
  writeJson(root, "collections/COL-DEMO.json", { ...collection, coverage: ["unknown"] });
  assert.throws(() => loadContent(root), /unknown coverage category unknown/);
});

test("collection attribution item scope must reference items in the same collection", () => {
  const root = createFixture();
  writeJson(root, "publishers.json", [
    { id: "PUB-DEMO", name: "示例整理者", type: "individual", updatedAt: "2026-10-20" }
  ]);
  const collection = {
    id: "COL-DEMO",
    publisherId: "PUB-DEMO",
    title: "示例题集",
    sourceUrl: "https://example.com/collection",
    sourceKind: "curated_question_set",
    access: "public",
    capturedAt: "2026-10-20",
    lastCheckedAt: "2026-10-20",
    verification: "verified_source",
    sourceClaim: "示例",
    items: [
      {
        id: "COL-DEMO-001",
        originalTitle: "示例问题",
        sourceUrl: "https://example.com/question",
        reviewStatus: "confirmed"
      }
    ]
  };
  const sourceAttribution = { name: "作者", role: "author", scope: "仅对应第一条原题。" };
  for (const itemIds of [undefined, ["COL-DEMO-001"]]) {
    const attribution = itemIds ? { ...sourceAttribution, itemIds } : sourceAttribution;
    writeJson(root, "collections/COL-DEMO.json", {
      ...collection,
      sourceAttribution: attribution
    });
    assert.deepEqual(loadContent(root).collections[0].sourceAttribution, attribution);
  }
  writeJson(root, "collections/COL-OTHER.json", {
    ...collection,
    id: "COL-OTHER",
    items: [{ ...collection.items[0], id: "COL-OTHER-001" }]
  });
  for (const itemId of ["COL-DEMO-999", "COL-OTHER-001"]) {
    writeJson(root, "collections/COL-DEMO.json", {
      ...collection,
      sourceAttribution: { ...sourceAttribution, itemIds: [itemId] }
    });
    assert.throws(
      () => loadContent(root),
      new RegExp(`sourceAttribution item must belong to this collection: ${itemId}`)
    );
  }
});

test("publishes the 89-question course as a complete public collection", () => {
  const collectionPath = path.join(repositoryRoot, "collections/COL-DIDILILI-AI-89.json");
  assert.equal(
    fs.existsSync(collectionPath),
    true,
    "the legacy course should have a first-class public collection"
  );

  const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));
  const publishers = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "publishers.json"), "utf8")
  );
  const didililiPublisher = publishers.find((publisher) => publisher.id === "PUB-DIDILILI");
  assert.ok(didililiPublisher, "the original public source should have an explicit publisher");
  assert.equal(didililiPublisher.avatarUrl, "https://avatars.githubusercontent.com/u/49889928?v=4");
  assert.equal(collection.publisherId, "PUB-DIDILILI");
  assert.equal(collection.sourceKind, "course_question_set");
  assert.equal(collection.access, "public");
  assert.equal(collection.verification, "verified_source");
  assert.equal(collection.declaredItemCount, 89);
  assert.equal(collection.items.length, 89);
  assert.ok(
    loadContent(repositoryRoot)
      .collections.find((item) => item.id === collection.id)
      .items.every((item) => !Object.hasOwn(item, "position"))
  );
  assert.deepEqual(
    collection.items.map((item) => item.id),
    Array.from(
      { length: 89 },
      (_, index) => `COL-DIDILILI-AI-89-${String(index + 1).padStart(3, "0")}`
    )
  );
  assert.equal(
    collection.items[0].originalTitle,
    "RAG 和微调（SFT）的核心区别是什么？能不能一起用？"
  );
  assert.equal(
    collection.items.at(-1).originalTitle,
    "如果让你总结“AI 应用工程师”和“算法研究岗”的差异，你会怎么说？"
  );

  const sourceUrls = new Set();
  for (const item of collection.items) {
    assert.equal(item.reviewStatus, "confirmed");
    assert.equal(Object.hasOwn(item, "matches"), false);
    assert.equal(Object.hasOwn(item, "presentation"), false);
    assert.match(
      item.sourceUrl,
      /^https:\/\/github\.com\/didilili\/ai-agents-from-zero\/blob\/ea7f28ffe0b2c2650e3936f3bb591560225702b3\/AI%E6%99%BA%E8%83%BD%E4%BD%93%E4%B8%8E%E5%A4%A7%E6%A8%A1%E5%9E%8B%E5%BA%94%E7%94%A8%E5%BC%80%E5%8F%91%E9%9D%A2%E8%AF%95%E9%A2%98%E5%BA%93\.md#L\d+$/
    );
    sourceUrls.add(item.sourceUrl);
  }
  assert.equal(sourceUrls.size, 89);

  const content = loadContent(repositoryRoot);
  const loadedCollection = content.collections.find((entry) => entry.id === collection.id);
  assert.equal(loadedCollection.items.length, 89);
});
