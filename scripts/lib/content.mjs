import fs from "node:fs";
import path from "node:path";
import { stripOnlineReadingLink } from "./online-reading.mjs";

import {
  createContentSchemaValidators,
  loadContentSchema,
  schemaGroup,
  schemaErrors
} from "./schema.mjs";

const reservedCategoryIds = new Set(["priority", "interviews", "collections"]);
const websiteContentPaths = new Map([
  ["relationships", "mianstack-web/content/relationships/"],
  ["projects", "mianstack-web/content/projects/"],
  ["families.json", "mianstack-web/content/families.json"],
  ["question-relations.json", "mianstack-web/content/question-relations.json"],
  ["collection-relations", "mianstack-web/content/collection-relations/"]
]);

export function websiteContentLocation(relativePath) {
  for (const [publicPath, websitePath] of websiteContentPaths)
    if (relativePath === publicPath || relativePath.startsWith(`${publicPath}/`))
      return websitePath;
  return "";
}

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

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value) {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim())
    )
  ];
}

function interviewSummaryFromContexts(contexts) {
  return {
    company: uniqueStrings(contexts.map((context) => context.company)).join("、") || "公司未注明",
    business: uniqueStrings(contexts.map((context) => context.business)).join("；"),
    role: uniqueStrings(contexts.map((context) => context.role)).join("、") || "岗位无法判断",
    roleFamilies: uniqueStrings(contexts.map((context) => context.roleFamily)),
    roleDirections: uniqueStrings(contexts.flatMap((context) => context.roleDirections || [])),
    jobNature: uniqueStrings(contexts.map((context) => context.jobNature)).join("、"),
    recruitment: uniqueStrings(contexts.map((context) => context.recruitment)).join("、"),
    batches: uniqueStrings(contexts.flatMap((context) => context.batches || [])),
    rounds: uniqueStrings(contexts.flatMap((context) => context.rounds || [])),
    base: uniqueStrings(contexts.map((context) => context.base)).join("、")
  };
}

function readJson(root, relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`, { cause: error });
  }
}

function readJsonArray(root, relativePath) {
  const value = readJson(root, relativePath);
  if (!Array.isArray(value)) throw new Error(`${relativePath}: expected an array`);
  return value;
}

function readJsonObject(root, relativePath) {
  const value = readJson(root, relativePath);
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error(`${relativePath}: expected an object`);
  return value;
}

function dataFiles(root, directory, pattern, label) {
  const entries = fs
    .readdirSync(path.join(root, directory), { withFileTypes: true })
    .filter(
      (entry) => entry.name !== ".DS_Store" && !(entry.isFile() && entry.name === "README.md")
    )
    .sort((first, second) => first.name.localeCompare(second.name));
  const errors = [];
  for (const entry of entries) {
    if (!entry.isFile() || !pattern.test(entry.name))
      errors.push(`invalid ${label} filename: ${entry.name}`);
  }
  return {
    files: entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
    errors
  };
}

export function parseFrontmatter(text, relativePath) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
  if (!match) throw new Error(`${relativePath}: missing JSON frontmatter`);
  try {
    const data = JSON.parse(match[1]);
    return { data, body: stripOnlineReadingLink(match[2] || "", data?.id) };
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON frontmatter: ${error.message}`, {
      cause: error
    });
  }
}

export function resolveGeneratedPath(root, relativePath) {
  const repositoryRoot = path.resolve(root);
  const target = path.resolve(repositoryRoot, relativePath);
  if (target !== repositoryRoot && !target.startsWith(`${repositoryRoot}${path.sep}`))
    throw new Error(`generated path is outside repository: ${relativePath}`);

  const segments = path.relative(repositoryRoot, target).split(path.sep).filter(Boolean);
  let current = repositoryRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error(`generated path contains a symbolic link: ${relativePath}`);
  }
  return target;
}

export function loadContent(inputRoot) {
  const root = path.resolve(inputRoot);
  const errors = [];
  const add = (message) => errors.push(message);
  for (const [relativePath, websitePath] of websiteContentPaths)
    if (fs.lstatSync(path.join(root, relativePath), { throwIfNoEntry: false }))
      add(`${relativePath}: private website content must be stored in ${websitePath}`);
  if (fs.existsSync(path.join(root, "assets", "interviews")))
    add("interview source images must not be archived under assets/interviews");
  const contentSchema = loadContentSchema(root);
  const schemaValidators = createContentSchemaValidators(contentSchema);
  const answeredStatuses = new Set(schemaGroup(contentSchema, "answerStatus", "answered"));
  const inferredRoleMethods = new Set(schemaGroup(contentSchema, "roleMethod", "inferred"));
  const validateSchema = (name, value, label) =>
    errors.push(...schemaErrors(schemaValidators[name], value, label));
  const uniqueIndex = (items, label) => {
    const result = new Map();
    for (const item of items) {
      if (!item || typeof item !== "object" || !requiredString(item.id)) continue;
      if (result.has(item.id)) add(`duplicate ${label} id: ${item.id}`);
      result.set(item.id, item);
    }
    return result;
  };

  const questionEntries = dataFiles(root, "questions", /\.md$/, "question");
  const interviewEntries = dataFiles(root, "interviews", /\.md$/, "interview");
  const collectionEntries = dataFiles(root, "collections", /\.json$/, "collection");
  errors.push(...questionEntries.errors, ...interviewEntries.errors, ...collectionEntries.errors);

  const readMarkdown = (directory, filenames, schemaName) =>
    filenames
      .filter((filename) => filename.endsWith(".md"))
      .map((filename) => {
        const relativePath = `${directory}/${filename}`;
        const parsed = parseFrontmatter(
          fs.readFileSync(path.join(root, relativePath), "utf8"),
          relativePath
        );
        validateSchema(schemaName, parsed.data, relativePath);
        if (!isRecord(parsed.data)) return { body: parsed.body, filename };
        const expectedId = path.basename(filename, ".md");
        if (parsed.data.id !== expectedId)
          add(`${relativePath}: filename must match id ${parsed.data.id}`);
        if (schemaName === "interview")
          for (const key of interviewSummaryFields)
            if (key in parsed.data)
              add(`${relativePath}: derived interview summary field ${key} must not be stored`);
        return { ...parsed.data, body: parsed.body, filename };
      });

  const questions = readMarkdown("questions", questionEntries.files, "question").map(
    (question) => ({
      note: "",
      aliases: [],
      formatTags: [],
      contextTags: [],
      ...question
    })
  );
  const interviews = readMarkdown("interviews", interviewEntries.files, "interview").map(
    (interview) => {
      if (!Array.isArray(interview.contexts) || !interview.contexts.every(isRecord))
        return interview;
      const contexts = interview.contexts.map((context) => ({
        business: "",
        department: "",
        roleFamily: "",
        roleConfidence: "",
        roleDirections: [],
        technicalDirections: [],
        jobNature: "",
        recruitment: "",
        batches: [],
        rounds: [],
        stages: [],
        base: "",
        ...context,
        roleInferred: inferredRoleMethods.has(context.roleMethod)
      }));
      return {
        publishedAt: "",
        lastCheckedAt: "",
        publicationRegion: "",
        result: "",
        statusReason: "",
        ...interview,
        contexts,
        ...interviewSummaryFromContexts(contexts)
      };
    }
  );
  const categories = readJsonArray(root, "categories.json");
  const aliases = readJsonArray(root, "aliases.json");
  const publishers = readJsonArray(root, "publishers.json");
  const collections = collectionEntries.files
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) => {
      const collection = readJsonObject(root, `collections/${filename}`);
      validateSchema("collection", collection, `collections/${filename}`);
      return { ...collection, filename };
    });
  for (const [name, items, label] of [
    ["category", categories, "category"],
    ["alias", aliases, "alias"],
    ["publisher", publishers, "publisher"]
  ])
    for (const item of items) validateSchema(name, item, `${label} ${item?.id || "(unknown)"}`);

  const questionById = uniqueIndex(questions, "question");
  const interviewById = uniqueIndex(interviews, "interview");
  const categoryById = uniqueIndex(categories, "category");
  const publisherById = uniqueIndex(publishers, "publisher");
  uniqueIndex(collections, "collection");

  const publisherHandles = new Map();
  const publisherIdRoutes = new Map([...publisherById.keys()].map((id) => [id.toLowerCase(), id]));
  for (const publisher of publishers) {
    if (!requiredString(publisher?.handle)) continue;
    const route = publisher.handle.toLowerCase();
    const previousId = publisherHandles.get(route);
    if (previousId)
      add(`duplicate publisher handle ${publisher.handle}: ${previousId} and ${publisher.id}`);
    else publisherHandles.set(route, publisher.id);
    const idOwner = publisherIdRoutes.get(route);
    if (idOwner && idOwner !== publisher.id)
      add(`publisher handle ${publisher.handle} conflicts with publisher id ${idOwner}`);
  }

  const interviewSerials = new Map();
  for (const interview of interviews) {
    const serialMatch = interview.id?.match(/^MJ-(?:NC|XHS)-(\d{4})-(\d{4,})$/);
    if (!serialMatch) continue;
    const [, year, serial] = serialMatch;
    const serialKey = `${year}-${serial}`;
    const previousId = interviewSerials.get(serialKey);
    if (previousId)
      add(`duplicate interview serial ${serialKey}: ${previousId} and ${interview.id}`);
    else interviewSerials.set(serialKey, interview.id);
  }

  for (const category of categories) {
    if (!isRecord(category)) continue;
    if (reservedCategoryIds.has(category.id))
      add(`category ${category.id}: id is reserved by generated indexes`);
  }

  for (const question of questions) {
    const label = `question ${question.id}`;
    const category = categoryById.get(question.category);
    if (!category) add(`${label}: unknown category ${question.category}`);
    else if (Array.isArray(category.topics) && !category.topics.includes(question.topic))
      add(`${label}: unknown topic ${question.topic}`);
    if (answeredStatuses.has(question.answerStatus) && !requiredString(question.body))
      add(`${label}: ready answer requires nonempty body`);
  }

  for (const interview of interviews) {
    const label = `interview ${interview.id}`;
    if (!requiredString(interview.body)) add(`${label}: body is required`);
    if (requiredString(interview.body)) {
      if (
        /^#### (?:正文要点|全文原文(?:（原文）)?)$/m.test(interview.body) ||
        /以下保留迁移前的完整档案章节|原帖还曾出现在迁移前的第 \d+ 个收录位置/.test(interview.body)
      )
        add(`${label}: body contains retired migration presentation text`);

      if (/^MJ-(?:NC|XHS)-/.test(interview.id)) {
        if (/^## 图片[ \t]*$/m.test(interview.body))
          add(`${label}: body must not contain a ## 图片 section`);
        const headings = [...interview.body.matchAll(/^## (原帖正文|有价值评论)$/gm)];
        const originalSections = headings.filter((heading) => heading[1] === "原帖正文");
        if (originalSections.length !== 1)
          add(`${label}: body must contain exactly one ## 原帖正文 section`);

        const expectedOrder = ["原帖正文", "有价值评论"];
        const actualOrder = headings.map((heading) => heading[1]);
        const ordered = actualOrder.every(
          (title, index) =>
            expectedOrder.indexOf(title) >= 0 &&
            (index === 0 ||
              expectedOrder.indexOf(actualOrder[index - 1]) < expectedOrder.indexOf(title))
        );
        const sectionContent = (heading, index) => {
          const start = heading.index + heading[0].length;
          const end = headings[index + 1]?.index ?? interview.body.length;
          return interview.body.slice(start, end).trim();
        };
        if (originalSections.length === 1) {
          const original = originalSections[0];
          const originalBody = sectionContent(original, headings.indexOf(original))
            .replace(/^[ \t]*(?:>[ \t]*)+/gm, "")
            .trim();
          if (!originalBody) {
            if (interview.sourceStatus !== "不可用")
              add(`${label}: available source requires nonempty original body`);
            else if (
              !requiredString(interview.statusReason) ||
              !requiredString(interview.curationNote)
            )
              add(`${label}: empty original body requires statusReason and curationNote`);
          }
        }
        const nonemptyOptionalSections = headings.every(
          (heading, index) => heading[1] === "原帖正文" || sectionContent(heading, index).length > 0
        );
        if (!ordered || !nonemptyOptionalSections)
          add(
            `${label}: source sections must follow 原帖正文、有价值评论 and optional sections must not be empty`
          );
        const hasCollectionPlaceholders = headings.some((heading, index) => {
          if (heading[1] === "原帖正文") return false;
          const content = sectionContent(heading, index);
          return (
            /^- 当前档案(?:没有|未收录)可确认的有效评论内容。?$/.test(content) ||
            /^- 页面(?:显示|评论区显示)?[“"]?暂无评论/.test(content) ||
            /^- 页面未见可提取为[“"]有价值评论[”"]的评论。?$/.test(content) ||
            /^以下保存本次公开页面返回的可见文字评论/.test(content)
          );
        });
        if (hasCollectionPlaceholders)
          add(
            `${label}: optional source sections must contain reader-useful material instead of collection placeholders`
          );
      }
    }
    const contexts = Array.isArray(interview.contexts) ? interview.contexts : [];
    for (const [index, context] of contexts.entries()) {
      if (!context || Array.isArray(context) || typeof context !== "object") continue;
      const contextLabel = `${label}: contexts[${index}]`;
      if (inferredRoleMethods.has(context.roleMethod) && !requiredString(context.roleConfidence))
        add(`${contextLabel}.roleConfidence is required for an inferred role`);
      else if (
        inferredRoleMethods.has(context.roleMethod) &&
        !["高", "中", "低"].includes(context.roleConfidence)
      )
        add(`${contextLabel}.roleConfidence must be 高, 中 or 低 for an inferred role`);
      if (context.roleMethod === "资料不足" && context.roleConfidence !== "不可判定")
        add(`${contextLabel}.roleConfidence must be 不可判定 when roleMethod is 资料不足`);
    }
  }

  const aliasFrom = new Set();
  const aliasMap = new Map();
  for (const alias of aliases) {
    if (aliasFrom.has(alias?.from)) add(`duplicate alias: ${alias?.from}`);
    aliasFrom.add(alias?.from);
    aliasMap.set(alias?.from, alias?.to);
    if (questionById.has(alias?.from)) add(`alias source is still active: ${alias?.from}`);
    if (!questionById.has(alias?.to)) add(`alias target is unknown: ${alias?.to}`);
  }
  for (const from of aliasFrom) {
    const seen = new Set([from]);
    let target = aliasMap.get(from);
    while (aliasMap.has(target)) {
      if (seen.has(target)) {
        add(`alias cycle detected from ${from}`);
        break;
      }
      seen.add(target);
      target = aliasMap.get(target);
    }
  }

  const collectionItemIds = new Set();
  for (const collection of collections) {
    const label = `collection ${collection.id}`;
    if (collection.filename !== `${collection.id}.json`) add(`${label}: filename must match id`);
    if (!publisherById.has(collection.publisherId))
      add(`${label}: unknown publisher ${collection.publisherId}`);
    if (Array.isArray(collection.coverage))
      for (const category of collection.coverage)
        if (!categoryById.has(category)) add(`${label}: unknown coverage category ${category}`);
    if (!Array.isArray(collection.items)) continue;
    if (Array.isArray(collection.sourceAttribution?.itemIds)) {
      const scopedItemIds = new Set(collection.items.map((item) => item?.id));
      for (const itemId of collection.sourceAttribution.itemIds)
        if (!scopedItemIds.has(itemId))
          add(`${label}: sourceAttribution item must belong to this collection: ${itemId}`);
    }
    collection.items.forEach((item) => {
      const itemLabel = `collection item ${item?.id}`;
      if (!new RegExp(`^${collection.id}-\\d{3}$`).test(item?.id || ""))
        add(`${itemLabel}: invalid id`);
      if (collectionItemIds.has(item?.id)) add(`duplicate collection item id: ${item?.id}`);
      collectionItemIds.add(item?.id);
    });
  }

  if (errors.length)
    throw new Error(
      `Content validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`
    );

  return {
    root,
    contentSchema,
    questions,
    interviews,
    categories,
    aliases,
    publishers,
    collections,
    questionById,
    interviewById,
    categoryById,
    publisherById
  };
}
