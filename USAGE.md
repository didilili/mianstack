# 使用面栈数据

本仓库可以独立读取、校验和生成索引，不需要安装在线网站的源码。直接阅读从 [INDEX.md](INDEX.md) 开始；做自己的检索、复习工具或阅读网站，可以使用下面的统一加载入口。

## 安装与读取

使用 `.node-version` 指定的 Node.js 版本，在仓库根目录运行：

```sh
npm ci
```

随后读取公开内容：

```sh
node --input-type=module <<'JS'
import { loadContent } from './scripts/lib/content.mjs';

const content = loadContent(process.cwd());
console.log({
  questions: content.questions.length,
  sourceRecords: content.interviews.length,
  collections: content.collections.length
});
console.log(content.questionById.get('Q-0140').title);
JS
```

`loadContent(root)` 接受内容仓库根目录，返回经过字段和跨文件引用校验的数据；不写文件。无效内容会抛出错误，并指出文件、字段或引用。首次 `npm ci` 会安装本仓库的 Git hook，后续加载数据不需要运行 hook。

主要返回值：

- `questions`：标准题目，包含元数据、Markdown `body` 和文件名。
- `interviews`：面经，包含 `contexts[]`、来源信息、原帖正文及自动整理的公司、岗位等摘要。
- `collections`、`publishers`：公开题集原题、阅读说明、来源与发布者。
- `categories`、`aliases`：知识分类与停用题号的兼容指向。
- `questionById`、`interviewById`、`categoryById`、`publisherById`：按 ID 查找的 `Map`。
- `contentSchema`：当前数据使用的 Schema，可配合 `scripts/lib/schema.mjs` 读取枚举、中文标签和统计分组。

问题和面经源文件顶部的“在面栈阅读”导航不属于正文；`loadContent` 与 `parseFrontmatter` 会自动排除该导航。

题集顶层的可选 `readingUrl` 是自动生成的面栈阅读链接，`sourceUrl` 仍是第三方原题集链接；读取旧数据快照时，保留对缺少 `readingUrl` 的兼容处理。

如果需要导出 JSON，请选择需要的数组字段；`Map` 不会被 `JSON.stringify()` 自动转换为键值对象。

## 关联与在线阅读

公开库保留题目、全部已有参考答案、面经原文、题集原题和各自出处。面经与标准题的对应、追问链、题族、题间关系及题集匹配与分段编排由网站维护，可通过文件中的“在面栈阅读”入口查看。

`loadContent()` 不返回 `relationships`、`occurrences`、`unresolved` 或 `families`，题目没有 `relations`，题集条目没有 `matches` 或 `presentation`。这些字段不属于本库当前公开数据；缺少它们不表示题目没有来源，也不能据此将来源数记作零。

旧题号仍通过 `aliases` 找到现用题号。稳定题号、面经与题集编号保持不变。

## 统计口径

- **标准题数**：`questions.length`，包含标准题与候选人反问，类型分组见公开 Schema。
- **面经篇数**：`interviews.length`。每篇保留原帖链接、作者和已收录的正文，可能包含单场面试、多轮合集或笔试记录。
- **题集与原题数**：分别使用 `collections.length` 和各题集的 `items.length`；原题审核状态、题意缺口说明与第三方出处保持原有含义。
- **公开答案数**：按 Schema 中 `answerStatus` 的 `answered` 分组统计。项目题与技术机制题的已有答案都在本库维护；网站直接读取，不保存正文副本。

题目与面经的出现频次、主要与辅助证据、题族来源数和题集匹配数量由网站根据关联数据计算，不能仅凭本公开库重算。

## 文件与渲染

题目、面经文件的 `---` 之间是 **JSON frontmatter**，后面是 Markdown 正文。不要把整个 Markdown 文件当成 JSON，也不要直接手改生成目录。

答案配图保存在 `assets/questions/{题号}/`，题目正文通过相对路径引用，例如 `![计算示意](../assets/questions/Q-0036/q-0036-848591d302fb.svg)`。复用题库时请连同该目录一起读取；生成网站时，将图片引用映射为站点资源 URL，并发布对应文件。Mermaid 图直接保留在 Markdown 代码块中。

来源正文的每行外包一层 `> `。自己实现阅读器时只解开这层归档包装，保留原帖内部的标题、列表、引用和代码结构。渲染来自外部的 Markdown 时，应按阅读器自身的策略处理 HTML 和外链。

`sourceStatus` 描述来源材料的可用性，`curationStatus` 描述整理进度。`lastCheckedAt` 是实际回源日期，缺失时加载器返回空字符串；不能用 `updatedAt` 推断最近核验时间。来源链接可能后续失效，分享链接中的参数也不应未经核对就删除。

完整字段见 [schema/README.md](schema/README.md)。[examples/](examples/) 提供公开题目与面经的最小示例，其中内容为虚构示例。

## 固定数据快照与兼容

复用数据时记录 `git rev-parse HEAD` 的完整提交 SHA，并固定该提交。这样公开内容数量与字段可以一起复现；只记录网站地址或分支名无法固定数据快照。

`package.json` 的版本属于维护工具包，不代表每次题库内容更新。字段删除、含义调整、枚举或编号策略变化会在 [CHANGELOG.md](CHANGELOG.md) 记录。读取可选字段时保留缺省处理，稳定 ID 不重排、不复用。

## 检查与索引生成

```sh
npm run validate       # 测试、全库内容与索引检查
npm run build:indexes  # 修改源文件后重新生成阅读目录
npm run format:check   # 只读格式检查，排除来源正文与生成目录
```

维护内容、更新字段或调整索引时，可参考 [维护说明](MAINTAINING.md)。
