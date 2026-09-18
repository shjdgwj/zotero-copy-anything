# 用户原始需求

请基于以下背景，fork 并修改 Zotero Copy Anything，使其支持 Windows 上的 Zotero 10。

## 背景

- 上游仓库：https://github.com/windfollowingheart/zotero-copy-anything
- 已审查版本为 v1.0.7。目前已核对的主分支与该版本仅有 README 差异。
- 插件用于从文献列表、阅读器和标签页复制附件文件，Windows 文件复制依赖外部程序 `copyfiles.exe`。
- 当前安装包将 Zotero 兼容上限设为 `9.*`，因此无法正常安装到 Zotero 10。
- Zotero 9 和 10 使用相同的 Firefox 140 ESR 内核。插件使用的 `getSelectedItems()`、`getAttachments()`、`getFilePath()`、阅读器事件、`Reader.getByTabID()` 和 `Zotero.Utilities.Internal.exec()` 在已核对的 Zotero 10 源码中仍然存在。
- 复制主流程没有调用 Zotero 10 移除的单选分类接口，预计可以通过局部修改完成适配。
- 官方迁移说明：https://www.zotero.org/support/dev/zotero_10_for_developers
- 用户主要使用 Windows，文献库同时包含 Zotero 托管附件、本地链接附件及少量已经断链的附件。

## 修改方式

1. **调整兼容声明**
   - 以 v1.0.7 为修改基础，将插件兼容上限调整为 `10.0.*`。
   - 同步处理插件清单、构建配置及更新清单中相关的版本声明，递增插件版本。
   - 保留原有功能及现有 Zotero 版本的兼容性，避免整体重写。

2. **修正复制程序的首次下载**
   - 重点查看 `src/modules/utils.ts`。
   - 当前下载 `copyfiles.exe` 前，没有创建目标保存目录。应在写入前创建所需目录。
   - 下载失败时明确报告错误，避免继续使用不存在或不完整的程序。
   - 继续复用现有 Windows 复制程序，不在本次任务中重写原生程序或扩展跨平台支持。

3. **正确处理附件路径**
   - `getFilePath()` 可能返回 `false`，不能通过 TypeScript 类型断言将其直接当作字符串传入 `IOUtils.exists()`。
   - 区分普通文献条目、文件附件及仅包含网址的附件，取得实际可复制的本地文件路径。
   - 兼容托管附件和链接附件；遇到缺失文件或没有可复制附件时给出明确反馈。

4. **修正复制失败处理**
   - `Zotero.Utilities.Internal.exec()` 在执行失败或程序返回非零退出码时会拒绝 Promise。
   - 使用正确的异步异常处理接住失败并显示原因。
   - 仅在复制程序成功退出后显示成功提示，避免现有 `if/else` 遗漏异常路径。

5. **修正阅读器上下文**
   - 重点查看 `src/modules/examples.ts` 中的阅读器及菜单入口。
   - 阅读器右键复制应使用事件对应的阅读器和附件，例如通过 `reader.itemID` 获取附件。
   - 避免重新读取主窗口当前标签来决定复制对象，防止独立阅读器窗口或多个标签页之间复制错文件。
   - 保留文献列表、阅读器、标签页及快捷键入口的现有功能。

6. **控制依赖和菜单改动**
   - 优先保留现有依赖锁文件。
   - 当前锁定的 toolkit 菜单接口已标记弃用，但不要因此整体升级依赖。
   - 如菜单确需调整，使用 Zotero 官方 `Zotero.MenuManager`，仅修改受影响的入口。

7. **配置自己的 fork**
   - 这是自用替换版，保留原插件 ID 和设置前缀，以沿用已有设置；原版与 fork 不并装。
   - 将仓库信息、发布配置和插件更新地址改为自己的 fork，避免修改版继续从上游更新。
   - 保留上游许可证和版权声明。

采用最小必要改动，不增加新功能，不进行无关重构。

创建一个合适的目录，开始执行
