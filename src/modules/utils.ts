import { getPref } from "../utils/prefs";

/** 复制本地文件；输入完整路径列表，输出完成通知。例如 await copyFiles(["C:\\paper.pdf"])。 */
async function copyFiles(filePaths: string[]) {
  try {
    const binaryFileInfo = await getBinaryFilePath();
    if (!binaryFileInfo.isExist) {
      throw new Error(
        `复制程序不存在，请重新下载：${binaryFileInfo.saveFilePath}`,
      );
    }

    // exec 在启动失败或非零退出时拒绝 Promise；只有正常退出才能提示成功。
    await Zotero.Utilities.Internal.exec(
      binaryFileInfo.saveFilePath,
      filePaths,
    );
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: `✅ 已复制 ${filePaths.length} 个文件。`,
        type: "success",
        progress: 100,
      })
      .show();
  } catch (error) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: `❌ 复制失败：${String(error)}`,
        type: "error",
        progress: 100,
      })
      .show();
  }
}

async function getBinaryFilePath(): Promise<BinaryFileInfo> {
  let downloadUrl = "";
  const binaryFileInfo: BinaryFileInfo = {
    downloadUrl: "",
    saveFilePath: "",
    isExist: false,
  };

  const saveDir = PathUtils.join(
    Zotero.DataDirectory.dir,
    "storage",
    "zotero-copy-anything",
  );
  let saveFilePath = "";
  if (Zotero.isWin) {
    downloadUrl =
      "https://gitee.com/windheartyolo/zotero-copy-anything/releases/download/binary/copyfiles.exe";
    saveFilePath = PathUtils.join(saveDir, "copyfiles.exe");
  } else if (Zotero.isMac) {
    downloadUrl =
      "https://gitee.com/windheartyolo/zotero-copy-anything/releases/download/binary/copyfiles-mac";
    saveFilePath = PathUtils.join(saveDir, "copyfiles-mac");
  } else if (Zotero.isLinux) {
    downloadUrl =
      "https://gitee.com/windheartyolo/zotero-copy-anything/releases/download/binary/copyfiles-linux";
    saveFilePath = PathUtils.join(saveDir, "copyfiles-linux");
  } else {
    console.log("Unsupported platform");
    throw new Error("Unsupported platform");
  }
  binaryFileInfo.isExist = await IOUtils.exists(saveFilePath);
  binaryFileInfo.downloadUrl = downloadUrl;
  binaryFileInfo.saveFilePath = saveFilePath;
  return binaryFileInfo;
}

/** 下载复制程序；输入无，输出是否就绪，失败显示原因。例如 await downloadBinaryFile()。 */
async function downloadBinaryFile(): Promise<boolean> {
  try {
    const { isExist, downloadUrl, saveFilePath } = await getBinaryFilePath();
    if (isExist) return true;

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new Error("下载内容为空");
    }

    // 完整接收响应后建目录并原子写入，失败的临时文件不会作为复制程序执行。
    await IOUtils.makeDirectory(PathUtils.parent(saveFilePath)!, {
      createAncestors: true,
    });
    await IOUtils.write(saveFilePath, bytes, {
      tmpPath: `${saveFilePath}.tmp`,
    });
    if (Zotero.isMac || Zotero.isLinux) {
      const chmodPaths = ["/bin/chmod", "/usr/sbin/chmod", "/usr/bin/chmod"];
      let chmodPath = "";
      for (const candidate of chmodPaths) {
        if (await IOUtils.exists(candidate)) {
          chmodPath = candidate;
          break;
        }
      }
      if (!chmodPath) throw new Error("Chmod command not found");
      await Zotero.Utilities.Internal.exec(chmodPath, ["777", saveFilePath]);
    }
    return true;
  } catch (error) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: `❌ 下载复制程序失败：${String(error)}`,
        type: "error",
        progress: 100,
      })
      .show();
    return false;
  }
}

async function copyFilesByExternalExtension(filePaths: string[]) {
  // 获取用户~目录
  // This property is deprecated. use FileUtils.getDir("Home", []).path instead.
  // const OS = Zotero.getMainWindow().OS;
  // const home = OS.Constants.Path.homeDir;
  const { FileUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/FileUtils.sys.mjs",
  );
  const home = FileUtils.getDir("Home", []).path;
  const targetPath = PathUtils.join(
    home,
    "zotero-copy-anything",
    "config.json",
  );
  console.log(targetPath);
  if (!(await IOUtils.exists(targetPath))) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: "❌ Copy Failed!",
        type: "error",
        progress: 100,
      })
      .show();
  }
  const config = await IOUtils.readJSON(targetPath);
  console.log(config);

  const port = config.port;
  console.log(port);
  if (!port) {
    console.log("Port not found");
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: "❌ Copy Failed!",
        type: "error",
        progress: 100,
      })
      .show();
    return;
  }
  try {
    // 发送http请求
    const response = await fetch(`http://localhost:${port}/copyfiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_path_list: filePaths,
      }),
    });

    if (!response.ok) {
      console.log("Copy files failed");
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: "❌ Copy Failed!",
          type: "error",
          progress: 100,
        })
        .show();
      return;
    }
    console.log(await response.json());

    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: "✅ Copy Success!",
        type: "success",
        progress: 100,
      })
      .show();
  } catch (error) {
    console.log("Copy files failed", error);
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: "❌ Copy Failed!",
        type: "error",
        progress: 100,
      })
      .show();
  }
}

/** 复制条目对应的本地附件；输入文献或附件，输出复制及缺失提示。例如 await copyItems([item])。 */
async function copyItems(items: Zotero.Item[]) {
  try {
    const paths: string[] = [];
    let missing = 0;
    for (const item of items) {
      const attachments = item.isAttachment()
        ? [item]
        : item.isRegularItem()
          ? item.getAttachments().map((id) => Zotero.Items.get(id))
          : [];
      for (const attachment of attachments) {
        // 网址附件没有本地文件；托管附件和链接附件均由 Zotero 解析实际路径。
        if (!attachment.isFileAttachment()) continue;
        const path = attachment.getFilePath();
        if (!path || !(await IOUtils.exists(path))) {
          missing++;
          continue;
        }
        paths.push(path);
      }
    }

    if (paths.length === 0) {
      throw new Error(
        missing
          ? `${missing} 个附件文件缺失，请同步文件或修复链接。`
          : "所选条目没有可复制的本地文件附件。",
      );
    }
    if (missing) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: `已跳过 ${missing} 个缺失附件，请同步文件或修复链接。`,
          type: "default",
          progress: 100,
        })
        .show();
    }
    if (getPref("manually-launch-executable-file")) {
      await copyFilesByExternalExtension(paths);
    } else {
      await copyFiles(paths);
    }
  } catch (error) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: `❌ 复制失败：${String(error)}`,
        type: "error",
        progress: 100,
      })
      .show();
  }
}

/**
 * 纯键盘按键监听函数 - 仅监听并输出按下的按键信息
 * 无注册逻辑，实时反馈按下的所有键（修饰键+普通键）
 */
function listenKeyboardKeys(
  win: Window,
  callback: (keyInfo: KeyboardEvent) => void,
) {
  // 键盘按下事件处理函数
  const handleKeyDown = (ev: KeyboardEvent) => {
    // 1. 基础按键信息
    const keyInfo = {
      // 原始按键名（区分大小写，如 "L"、"S"、"Enter"）
      rawKey: ev.key,
      // 小写按键名（统一格式）
      key: ev.key.toLowerCase(),
      // 修饰键状态
      modifiers: {
        shift: ev.shiftKey, // Shift键是否按下
        ctrl: ev.ctrlKey, // Ctrl键是否按下
        alt: ev.altKey, // Alt键是否按下
        meta: ev.metaKey, // Meta键（Win/Command）是否按下
      },
      // 按键码（兼容老浏览器）
      keyCode: ev.keyCode,
      // 是否是功能键（F1-F12）
      isFunctionKey: ev.key.startsWith("F") && !isNaN(Number(ev.key.slice(1))),
    } as any;

    // 2. 格式化输出（方便查看）
    const pressedModifiers = [];
    if (keyInfo.modifiers.ctrl) pressedModifiers.push("Ctrl");
    if (keyInfo.modifiers.shift) pressedModifiers.push("Shift");
    if (keyInfo.modifiers.alt) pressedModifiers.push("Alt");
    if (keyInfo.modifiers.meta) pressedModifiers.push("Meta(Win/Command)");

    // 拼接最终提示文本
    let logText = `按下了：`;
    if (pressedModifiers.length > 0) {
      logText += `${pressedModifiers.join("+")}+${keyInfo.rawKey}`;
    } else {
      logText += keyInfo.rawKey;
    }

    // 3. 控制台输出（清晰易读）
    // console.log("=== 键盘按键信息 ===");
    // console.log(logText);
    // console.log("完整信息：", keyInfo);
    // console.log("--------------------");

    callback(keyInfo);

    // 可选：阻止默认行为（如不想让Ctrl+S触发浏览器保存，可取消注释）
    // ev.preventDefault();
  };

  // 绑定键盘按下事件（监听整个文档）
  // Zotero.getMainWindow().document.addEventListener("keydown", handleKeyDown);
  win.document.addEventListener("keydown", handleKeyDown);

  // 返回取消监听的函数（方便后续停止监听）
  return function stopListening() {
    // Zotero.getMainWindow().document.removeEventListener(
    //   "keydown",
    //   handleKeyDown,
    // );
    win.document.removeEventListener("keydown", handleKeyDown);
    // console.log("已停止监听键盘按键");
  };
}

export {
  copyFiles,
  getBinaryFilePath,
  downloadBinaryFile,
  copyItems,
  listenKeyboardKeys,
};
