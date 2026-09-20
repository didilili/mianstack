# 内容结构

可执行校验位于同级 `mianstack-web/src/lib/content.mjs`。当前约定：

- 题目文件名必须与 `id` 一致，格式为 `Q-0001.md`
- 面经文件名必须与 `id` 一致，格式为 `MJ-NC-YYYY-NNNN.md`
- 题单文件名必须与 `id` 一致，格式以 `COL-` 开头
- 每篇面经必须有同名关系文件
- 题单只保存原题标题和公开地址，不保存答案或完整第三方正文
- `equivalent`、`variant` 和 `compound_part` 形成公开收录关系，`related` 不计入题单收录数
