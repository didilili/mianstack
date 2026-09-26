# 参与贡献

感谢你帮助面栈把 AI 面试题和答案做得更准确、更实用。

面栈是一个可以独立阅读和维护的公开题库。贡献者只需要当前仓库和 Node.js 22 或更高版本，不依赖其他项目。

## 可以贡献什么

- 修正错字、失效链接、分类错误或事实错误
- 补充或改进一道题的参考答案
- 补全题目的主要考点、其他常见问法、难度或适用岗位
- 提交有公开来源的真实面经线索
- 核对一道题是否确实出现在相应的面经或题集中
- 改进字段说明、维护文档和索引脚本

小修正可以直接提交 Pull Request。新增一批题目、调整现有分类、改变数据结构或导入大量来源材料前，请先创建 Issue，说明准备增加什么、内容来自哪里，以及打算怎么整理。

可以使用仓库提供的 Issue 表单提交[内容纠错](https://github.com/didilili/mianstack/issues/new?template=content-correction.yml)、[答案建议](https://github.com/didilili/mianstack/issues/new?template=answer-suggestion.yml)、[批量内容或结构调整](https://github.com/didilili/mianstack/issues/new?template=structure-proposal.yml)或[权利反馈](https://github.com/didilili/mianstack/issues/new?template=rights-request.yml)。

## 第一次贡献建议

1. 从 [题库总索引](INDEX.md) 找到一道你熟悉的题。
2. 检查题干是否清楚、答案是否准确、题目出处是否对应。
3. 完成一组边界清楚的修改。
4. 更新并检查索引后提交 Pull Request。

请尽量让一次 Pull Request 只解决一类问题，方便审阅和回退。

## 第三方内容边界

提交面经或题集来源时：

- 必须保留原作者、原始链接和可见的发布时间等来源信息。
- 不提交付费内容、私密群聊、内部资料、未公开面试记录或含敏感个人信息的材料。
- 不把搜索摘要、推广文案或模型改写当作原文。
- 只提交你有权提供的正文；没有再发布授权时，优先提交链接、必要的有限引用和自己的整理说明。
- 面经中的作者回答与面栈整理的参考答案必须分开，不能互相冒充。

## 题号与相近问题

- 题目使用 `Q-0001` 格式；已有题号不重排、不复用。
- 面经按来源使用 `MJ-NC-YYYY-NNNN`（牛客）或 `MJ-XHS-YYYY-NNNN`（小红书）；已有编号不因标题或分类变化而改变。
- 公开题集使用 `COL-*` 编号。
- 如果几种问法考查的是同一件事，可以整理到同一道标准题目下。

字段和引用约束见 [schema/README.md](schema/README.md)。

## 提交流程

1. Fork 并克隆本仓库。
2. 创建一个边界清楚的分支。
3. 修改内容并完成必要检查。
4. 提交 Pull Request，说明改了什么、为什么改，以及内容来源。

Pull Request 中请特别说明：

- 新增或修改了哪些题目、面经或对应记录；
- 技术结论的主要依据；
- 是否包含第三方内容，以及是否已经确认展示范围；
- 是否改变已有编号、分类或字段。

## 贡献许可

提交贡献即表示你有权提供相关内容，并同意将自己的贡献按照 [MIT License](LICENSE) 发布。第三方材料仍由原作者决定如何使用，不会因为提交 Pull Request 自动改用 MIT License。
