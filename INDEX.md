# 面栈题库索引

> 本文件由 `npm run build:indexes` 生成，请勿手工修改。

面栈面向准备 AI Agent、LLM 应用、RAG、模型训练及相关工程岗位的求职者，是一个可以直接阅读、也欢迎共同完善的面试题库与答案库。题目记录主要考点和答案完成情况，面经与题集保留来源信息；[mianstack.com](https://mianstack.com) 提供搜索、筛选和复习功能。

## 页内导航

- [当前内容](#current-content)
- [推荐起点](#recommended-starts)
- [按知识方向浏览](#knowledge-directions)
- [按来源浏览](#source-indexes)
- [仓库内容](#repository-content)
- [编号说明](#id-conventions)

<a id="current-content"></a>
## 当前内容

- 8,429 道整理后的面试题
- 957 篇真实面经
- 356 份公开题集
- 18 位公开题集发布者
- 690 道参考答案可直接阅读

仓库提供题目、公开参考答案和来源材料。题目与来源的关联、前后追问和其他编排可在[面栈网站](https://mianstack.com)阅读。

<a id="recommended-starts"></a>
## 推荐起点

- [优先准备的核心题](indexes/priority.md)
- [Agent 面试题](indexes/agent.md)
- [RAG 面试题](indexes/rag.md)
- [真实面经索引](indexes/interviews.md)

<a id="knowledge-directions"></a>
## 按知识方向浏览

| 方向 | 题目数 | 专题数 | 入口 |
| --- | ---: | ---: | --- |
| 模型基础与推理 | 1155 | 8 | [查看题目](indexes/llm.md) |
| RAG 与知识系统 | 493 | 13 | [查看题目](indexes/rag.md) |
| Agent 原理与系统 | 1145 | 12 | [查看题目](indexes/agent.md) |
| AI 应用工程与治理 | 1193 | 10 | [查看题目](indexes/ai-engineering.md) |
| 模型训练与对齐 | 762 | 9 | [查看题目](indexes/training.md) |
| 软件工程基础 | 2493 | 20 | [查看题目](indexes/software.md) |
| 算法与编程题 | 504 | 9 | [查看题目](indexes/coding.md) |
| 项目与综合面试 | 684 | 9 | [查看题目](indexes/career.md) |

<a id="source-indexes"></a>
## 按来源浏览

- [真实面经索引](indexes/interviews.md)
- [公开题集索引](indexes/collections.md)
- [候选人反问题目](indexes/career.md#候选人反问)

<a id="repository-content"></a>
## 仓库内容

| 路径 | 内容 |
| --- | --- |
| [`questions/`](questions/) | 面试题、主要考点和参考答案 |
| [`interviews/`](interviews/) | 面经来源信息与已收录的来源材料 |
| [`collections/`](collections/) | 其他公开题集收录的题目 |
| [`categories.json`](categories.json) | 知识方向与专题 |
| [`aliases.json`](aliases.json) | 已合并稳定题号的一对一指向 |
| [`publishers.json`](publishers.json) | 公开题集发布者和来源主页 |
| [`examples/`](examples/) | 题目和面经的最小示例 |
| [`schema/`](schema/) | 字段和引用约定 |
| [`scripts/`](scripts/) | 内容校验与索引生成脚本 |
| [`tests/`](tests/) | 校验器的回归测试 |

使用这些数据开发检索、复习工具或阅读网站，见[数据使用说明](USAGE.md)；格式与维护变化见[变更记录](CHANGELOG.md)。

<a id="id-conventions"></a>
## 编号说明

- `Q-*`：整理后的面试题。
- `MJ-NC-*`：牛客面经来源记录。
- `MJ-XHS-*`：小红书面经来源记录。
- `COL-*`：公开题集记录。

面经保留来源前缀，但末尾流水号按年份由所有来源共用。题号、面经编号和题集编号一经使用就不会重新排序或重复使用。来源正文保留已收录的原始问法；题目与来源的对应关系由网站维护。

继续阅读：[项目介绍](README.md) · [贡献指南](CONTRIBUTING.md) · [字段说明](schema/README.md) · [维护说明](MAINTAINING.md)
