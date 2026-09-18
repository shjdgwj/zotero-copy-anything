<div align="center">
  <img src="asserts/zotero-copy-anything.png" width="50%" />

# Zotero Copy Anything

</div>

## Windows / Zotero 10 自用版

本 fork 基于上游 v1.0.7，版本为 **1.0.8**，兼容声明为 Zotero `6.999` 至 `10.0.*`。保留原插件 ID、设置前缀和 AGPL-3.0-or-later 许可证，原作者为 windfollowingheart。

下载 [v1.0.8 安装包](https://github.com/shjdgwj/zotero-copy-anything/releases/download/v1.0.8/zotero-copy-anything.xpi)，在 Zotero 的“工具 → 插件”中选择“从文件安装插件”。此版本替换原插件，沿用已有设置，后续更新指向本 fork。

本次修复首次下载前创建目录、临时文件原子写入、下载与执行失败提示、托管及链接附件的路径检查，以及独立阅读器窗口的复制对象。存在缺失附件时，提示跳过数量并复制其余本地文件；没有可复制文件时停止操作。Windows 仍使用上游 `copyfiles.exe`，下载来源及手动运行模式保留。

本地检查与打包：

```bash
npm ci
npm run test:copy
npm run build
```

安装包和自动生成的更新清单位于 `.scaffold/build/`。`package.json.repository` 决定构建及发布仓库，`addon/manifest.json` 决定兼容范围；`npm run release` 与 tag 发布工作流均使用 fork 配置。原始需求见 [prd-zotero10.md](doc/prd-zotero10.md)。

验证：8 组自动回归检查、TypeScript 检查与构建通过；Windows 上使用 Zotero 10.0.3 独立配置和临时文献库加载插件，启动测试通过，首次下载的 `copyfiles.exe` 为 1,938,432 字节。复制错误、附件筛选和菜单上下文由模拟 Zotero API 的回归检查覆盖；系统剪贴板粘贴及各窗口的人工交互尚未验证。

# Download

- [本 fork 安装包](https://github.com/shjdgwj/zotero-copy-anything/releases/download/v1.0.8/zotero-copy-anything.xpi)

# How to use?

## Copy item attachment to clipboard.

<div align="center">
  <img src="asserts/1.png" width="100%" />
  <img src="asserts/4.png" width="100%" />
</div>

CTRL+V can paste the attachment to the clipboard.

<div align="center">
  <img src="asserts/2.png" width="100%" />
</div>

If the item is not synchronized to the local, it cannot be copied.

<div align="center">
  <img src="asserts/3.png" width="100%" />
</div>

## Register the copy shortcut.

Click the "Register Copy Shortcut" button, and then press the shortcut key combination you want to use.

This shortcut can only copy selected items.

<div align="center">
  <img src="asserts/5.png" width="100%" />
</div>

## Download Binary File.

The plugin requires binary files to run, which need to be downloaded from the internet. If the download fails, you can also manually download and place them in the specified directory. Then restart Zotero.

### Get the specified directory

`{ZOTERO_DATA_DIR}/storage/zotero-copy-anything`
`ZOTERO_DATA_DIR` can be obtained as follows:

<div align="center">
  <img src="asserts/6.png" width="100%" />
</div>
if the directory: `zotero-copy-anything` does not exist, create it.

### Binary file download links

- Windows: [windows](https://gitee.com/windheartyolo/zotero-copy-anything/releases/download/binary/copyfiles.exe)
- MacOS: [macos](https://gitee.com/windheartyolo/zotero-copy-anything/releases/download/binary/copyfiles-mac)
- Linux: [linux](https://gitee.com/windheartyolo/zotero-copy-anything/releases/download/binary/copyfiles-linux)

# Support Platform

- Windows
- MacOS
- Linux

## Linux

need to install `xclip` and `wl-clipboard`

# Features

- Copy item attachment to clipboard.
- Support multiple attachments copy.
- Support multiple attachment formats.

# Manualually launch the executable file

Due to permission limitations of Zotero, the API that uses plugins to spawn subprocesses and run external executable files is unstable. If errors occur during copying, try enabling this option.

<div align="center">
  <img src="asserts/7.png" width="100%" />
</div>

## Executable file download links

only support windows currently

- Windows: [windows](https://gitee.com/windheartyolo/zotero-copy-anything/releases/download/manual_executable/zotero-copy-anything.exe)

Download the executable and start it. Then you can copy in Zotero software.

Detail: [README_manual_exe.md](doc/README_manual_exe.md)

# Thanks

- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)

---
