# 内容结构

返回：[项目介绍](../README.md) · [内容索引](../INDEX.md) · [贡献指南](../CONTRIBUTING.md) · [维护说明](../MAINTAINING.md)

公开内容和索引都在当前仓库中维护。JSON 文件使用 UTF-8；Markdown 文件以一段 JSON frontmatter 开头，换行统一为 LF。

## 全局规则

- ID 和文件名必须一致：题目为 `Q-0001.md`，牛客面经为 `MJ-NC-YYYY-NNNN.md`，小红书面经为 `MJ-XHS-YYYY-NNNN.md`，题集为 `COL-*.json`。
- 面经末尾流水号按年份由所有来源共用；例如牛客使用到 `MJ-NC-2026-0508` 后，小红书从 `MJ-XHS-2026-0509` 继续，不能因来源不同重复使用 `2026-0509`。
- 已使用的题号、面经编号和题集编号不得重排或复用。合并题目时保留别名，删除策略需先通过 Issue 确认。
- 所有 ID 必须唯一；引用必须指向现有记录。
- 生成文件只包括 `INDEX.md` 和 `indexes/*.md`，不要手工修改。
- 题集只保存原题标题和公开地址，不保存第三方答案或完整正文。
- 下表说明字段用途；字段的固定中文名称由 schema 中相应属性的 `title` 定义，固定值由 `$defs` 定义，Web 不另建一份常量表。

## 题目 `questions/Q-*.md`

| 字段 | 固定中文名称 | 类型 | 约束 |
| --- | --- | --- | --- |
| `id` | 题目编号 | string | 与文件名一致，格式 `Q-` 加至少四位数字 |
| `title` | 标准题目 | string | 整理后的标准问法 |
| `category` | 知识分类 | string | 必须是 `categories.json` 中的现有分类编号 |
| `topic` | 知识专题 | string | 必须属于当前知识分类 |
| `type` | 问题类型 | enum | 取值见 schema 的 `questionType` |
| `level` | 技术难度 | enum | 取值见 schema 的 `questionLevel` |
| `priority` | 准备优先级 | enum | 取值见 schema 的 `questionPriority` |
| `focus` | 考查重点 | string | 说明这道题主要考查的边界 |
| `note` | 整理备注 | string | 可选；有维护说明时填写，不作为参考答案 |
| `aliases` | 相关关键词 | string[] | 可选；有别名或搜索词时填写 |
| `formatTags` | 问法形式标签 | string[] | 可选；有标签时填写 |
| `contextTags` | 场景标签 | string[] | 可选；有标签时填写 |
| `answerStatus` | 答案状态 | enum | 取值和显示见 schema 的 `answerStatus` |
| `updatedAt` | 更新时间 | date | `YYYY-MM-DD` |

`answerStatus` 的取值、固定中文显示和“已有完整答案”分组统一定义在 schema 的 `answerStatus` 中。frontmatter 之后的 Markdown 正文固定称为“参考答案”；属于 schema `answered` 分组的状态必须有非空正文。来源材料中的作者回答不能直接当作面栈参考答案。

## 面经 `interviews/MJ-*.md`

frontmatter 保存来源身份和检索元数据，正文保存允许公开展示的来源材料。

| 字段 | 固定中文名称 | 类型 | 约束 |
| --- | --- | --- | --- |
| `id` | 归档编号 | string | 与文件名一致；当前使用 `MJ-NC-YYYY-NNNN` 或 `MJ-XHS-YYYY-NNNN`，末尾流水号在同一年跨来源唯一 |
| `title` | 整理标题 | string | 归档使用的结构化标题；Web 可根据结构化字段生成读者标题 |
| `originalTitle` | 原帖标题 | string | 可为空 |
| `company` | 所属公司 | string | 来源中的公司或组织名称 |
| `business` | 业务方向 | string | 可为空 |
| `role` | 岗位 | string | 面经的主要岗位 |
| `roleFamilies` | 岗位方向 | string[] | 可为空 |
| `contexts` | 公司与岗位记录 | object[] | 每项使用下表字段 |
| `jobNature` | 岗位类型 | enum | 可为空；取值见 schema 的 `jobNature` |
| `recruitment` | 招聘类型 | enum | 可为空；取值见 schema 的 `recruitment` |
| `batches` | 招聘批次 | enum[] | 可为空；取值见 schema 的 `batch` |
| `rounds` | 面试阶段 | enum[] | 可为空；取值见 schema 的 `round` |
| `base` | 工作地点 | string | 可为空；不要用发布地代替 |
| `publishedAt` | 发布时间 | datetime | 可为空；日期可带时分秒 |
| `publicationRegion` | 发布地 | string | 可为空；只表示内容发布地区 |
| `author` | 作者 | string | 来源署名 |
| `url` | 原帖链接 | URL | 必须是 HTTP(S) 地址 |
| `contentType` | 内容类型 | enum | 取值见 schema 的 `interviewContentType` |
| `result` | 面试结果 | string | 可为空 |
| `sourceStatus` | 来源状态 | enum | 取值见 schema 的 `interviewSourceStatus`；只描述来源材料的可用性 |
| `statusReason` | 状态原因 | enum | 可为空；记录不可用、重复或待核实的明确原因 |
| `curationStatus` | 整理状态 | enum | 取值见 schema 的 `interviewCurationStatus`；只描述人工整理进度 |
| `curationNote` | 整理说明 | string | 可为空；记录整理依据、缺口和边界 |
| `updatedAt` | 更新时间 | date | `YYYY-MM-DD` |

面经状态和内容类型的固定值分别见 schema 的 `interviewContentType`、`interviewSourceStatus`、`interviewStatusReason` 和 `interviewCurationStatus`。

`sourceStatus` 和 `curationStatus` 是两个独立维度。例如来源可以是“完整可用”，但人工整理仍处于“部分整理”；来源重复、原文不足或真实性待核等结论放入 `statusReason`，不要再混入两个状态字段。

`contexts[]` 的字段：

| 字段 | 固定中文名称 | 类型 | 约束 |
| --- | --- | --- | --- |
| `company` | 所属公司 | string | 当前记录对应的公司或组织 |
| `business` | 业务方向 | string | 可为空 |
| `department` | 部门 | string | 可为空 |
| `roleFamily` | 岗位方向 | string | 可为空 |
| `role` | 岗位 | string | 可为空 |
| `roleMethod` | 岗位判定方式 | enum | 取值见 schema 的 `roleMethod` |
| `roleInferred` | 岗位是否推断 | boolean | 推测得出的岗位使用 `true`；来源明示或职责直接支持使用 `false` |
| `roleConfidence` | 岗位置信度 | enum | 可为空；取值见 schema 的 `roleConfidence` |
| `technicalDirections` | 技术方向 | string[] | 可为空 |
| `jobNature` | 岗位类型 | enum | 可为空；取值见 schema 的 `jobNature` |
| `recruitment` | 招聘类型 | enum | 可为空；取值见 schema 的 `recruitment` |
| `batches` | 招聘批次 | enum[] | 可为空；取值见 schema 的 `batch` |
| `rounds` | 面试阶段 | enum[] | 可为空；取值见 schema 的 `round` |
| `stages` | 面试环节 | enum[] | 可为空；取值见 schema 的 `interviewStage` |
| `base` | 工作地点 | string | 可为空 |

`roleMethod` 与 `roleInferred` 必须表达同一证据结论：`原文明示`、`职责支持` 和 `资料不足` 使用 `false`；`面试内容推测`、`标题与索引推断` 和 `职责推断` 使用 `true`，并填写高、中或低置信度。`职责支持` 表示来源正文直接说明了岗位职责，足以规范化岗位名称；`职责推断` 表示仅能根据职责线索推测岗位。`资料不足` 的置信度固定为 `不可判定`。

`contexts` 是公司、岗位、轮次等组合关系的权威数据。顶层 `company`、`business`、`role`、`roleFamilies`、`jobNature`、`recruitment`、`batches`、`rounds` 和 `base` 只是供展示与检索使用的聚合摘要，必须与 `contexts` 的去重聚合结果完全一致。即使只有一条公司与岗位记录，也保留一个 `contexts[]` 项，避免单条与多条记录采用两套结构。

frontmatter 之后的 Markdown 正文固定称为“来源正文”。

正文、图片、评论和直接引用仍受原作者权利约束；没有再发布依据时只保留链接、必要的有限引用和自己的整理说明。详见[内容许可说明](../CONTENT_LICENSE.md)。

## 知识分类 `categories.json`

| 字段 | 固定中文名称 | 类型 | 约束 |
| --- | --- | --- | --- |
| `id` | 分类编号 | string | 安全的机器 ID；不能使用生成索引保留名 |
| `title` | 分类名称 | string | Web 展示的知识分类名称 |
| `description` | 分类说明 | string | 说明分类范围 |
| `topics` | 知识专题 | string[] | 分类内不得重复 |

`priority`、`interviews` 和 `collections` 是生成索引保留名，不能作为分类编号。

## 题号别名 `aliases.json`

| 字段 | 固定中文名称 | 类型 | 约束 |
| --- | --- | --- | --- |
| `from` | 停用题目编号 | string | 不能仍是活动题目 |
| `to` | 现用题目编号 | string | 必须指向现有题目 |
| `reason` | 合并原因 | string | 说明题号归并依据 |

别名不能重复或形成环。

## 公开题集

### 整理者 `publishers.json`

| 字段 | 固定中文名称 | 类型 | 约束 |
| --- | --- | --- | --- |
| `id` | 整理者编号 | string | 格式 `PUB-*` |
| `name` | 整理者名称 | string | Web 展示名称 |
| `type` | 整理者类型 | enum | 取值和显示见 schema 的 `publisherType` |
| `homepage` | 作者主页 | URL | 必须是 HTTP(S) 地址 |
| `homepageLabel` | 主页链接文案 | string | 可选；如“查看来源文档” |
| `updatedAt` | 更新时间 | date | `YYYY-MM-DD` |

`type` 的取值和固定中文显示统一定义在 schema 的 `publisherType` 中。

### 面试题集 `collections/*.json`

| 字段 | 固定中文名称 | 类型 | 约束 |
| --- | --- | --- | --- |
| `id` | 题集编号 | string | 与文件名一致，格式 `COL-*` |
| `publisherId` | 整理者编号 | string | 必须指向 `publishers.json` 中的现有整理者 |
| `title` | 题集名称 | string | Web 展示标题 |
| `sourceUrl` | 原题集链接 | URL | 必须是 HTTP(S) 地址 |
| `sourceKind` | 题集类型 | enum | 取值见 schema 的 `collectionKind` |
| `access` | 访问范围 | enum | 取值和显示见 schema 的 `collectionAccess` |
| `declaredItemCount` | 原页面标注题数 | integer | 可选的非负整数；可与当前收录数不同 |
| `capturedAt` | 收录日期 | date | `YYYY-MM-DD` |
| `lastCheckedAt` | 最近复核日期 | date | `YYYY-MM-DD` |
| `verification` | 来源核验方式 | enum | 取值见 schema 的 `collectionVerification` |
| `sourceClaim` | 来源声明 | string | 记录发布者声明及本站核验边界 |
| `items` | 题集条目 | object[] | 按 `position` 连续排列 |

`items[]` 的字段：

| 字段 | 固定中文名称 | 类型 | 约束 |
| --- | --- | --- | --- |
| `id` | 题集条目编号 | string | 格式为题集编号加三位序号 |
| `position` | 原题序号 | integer | 从 1 开始连续排列 |
| `originalTitle` | 原题标题 | string | 保留来源中的题目标题 |
| `sourceUrl` | 原题链接 | URL | 必须是 HTTP(S) 地址 |
| `reviewStatus` | 原题审核状态 | enum | 取值见 schema 的 `collectionReviewStatus` |
| `reviewNote` | 审核说明 | string | 可为空 |
