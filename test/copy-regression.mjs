import assert from "node:assert/strict";
import { win32 as path } from "node:path";
import { test } from "node:test";
import { setImmediate } from "node:timers";
import vm from "node:vm";
import { build } from "esbuild";

const bundles = await Promise.all(
  ["utils", "examples"].map(
    async (name) =>
      (
        await build({
          entryPoints: [`src/modules/${name}.ts`],
          bundle: true,
          write: false,
          format: "cjs",
          platform: "node",
        })
      ).outputFiles[0].text,
  ),
);
const binary = "C:\\Zotero\\storage\\zotero-copy-anything\\copyfiles.exe";

/** 创建隔离的 Zotero/文件系统替身；输入无，输出环境。例如 env().api.copyItems([])。 */
function env() {
  const files = new Map([[binary, new Uint8Array([77, 90])]]);
  const directories = new Set();
  const notices = [];
  const executions = [];
  const items = new Map();
  const menus = [];
  const listeners = [];
  const prefs = new Map();
  const sandbox = {
    console: { log() {} },
    Uint8Array,
    PathUtils: { join: path.join, parent: path.dirname },
    addon: { data: { config: { addonName: "Copy Anything" } } },
    IOUtils: {
      async exists(file) {
        assert.equal(typeof file, "string", "不能将 false 传给 exists");
        return files.has(file);
      },
      async makeDirectory(dir) {
        directories.add(dir);
      },
      async write(file, bytes, options) {
        assert.ok(directories.has(path.dirname(file)), "必须先创建目录");
        assert.ok(options?.tmpPath, "必须使用临时文件完成写入");
        files.set(file, bytes);
        return bytes.length;
      },
    },
    fetch: async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([77, 90]).buffer,
    }),
    Zotero: {
      isWin: true,
      DataDirectory: { dir: "C:\\Zotero" },
      Prefs: { get: (key) => prefs.get(key.split(".").at(-1)) },
      Items: { get: (id) => items.get(id) },
      Reader: {
        registerEventListener: (name, callback) => listeners.push(callback),
        getByTabID: () => ({ itemID: 1, _item: items.get(1) }),
      },
      MenuManager: { registerMenu: (menu) => menus.push(menu) },
      Utilities: {
        Internal: {
          exec: async (exe, paths) => {
            executions.push({ exe, paths: Array.from(paths) });
            return true;
          },
        },
      },
    },
    ztoolkit: {
      log() {},
      getGlobal: (name) =>
        name === "Zotero_Tabs"
          ? { selectedID: "main-tab" }
          : { getSelectedItems: () => [items.get(1)] },
      Menu: { register: (target, menu) => menus.push(menu) },
      Keyboard: { register: (callback) => listeners.push(callback) },
      ProgressWindow: class {
        createLine(line) {
          notices.push(line);
          return this;
        }
        show() {}
      },
    },
    module: { exports: {} },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(bundles[0], context);
  const api = sandbox.module.exports;
  sandbox.module = { exports: {} };
  vm.runInContext(bundles[1], context);
  return {
    api,
    ui: sandbox.module.exports,
    sandbox,
    files,
    notices,
    executions,
    items,
    menus,
    listeners,
    prefs,
  };
}

/** 构造附件；输入路径或 false、是否本地文件，输出附件替身。例如 attachment(false)。 */
function attachment(file, isFile = true) {
  return {
    isAttachment: () => true,
    isFileAttachment: () => isFile,
    isRegularItem: () => false,
    getFilePath: () => file,
  };
}

/** 构造普通文献；输入附件 ID，输出条目替身。例如 regular([1, 2])。 */
function regular(ids) {
  return {
    isAttachment: () => false,
    isRegularItem: () => true,
    getAttachments: () => ids,
  };
}

/** 判断是否产生成功提示；输入测试环境，输出布尔值。例如 succeeded(env()) === false。 */
function succeeded(e) {
  return e.notices.some((line) => line.type === "success");
}

test("首次下载先建目录，并通过临时文件写入", async () => {
  const e = env();
  e.files.delete(binary);
  assert.equal(await e.api.downloadBinaryFile(), true);
  assert.ok(e.files.has(binary));
});

test("HTTP、网络、响应中断、空响应、磁盘失败均报告原因且不执行", async () => {
  for (const failure of [
    "HTTP 503",
    "network offline",
    "body interrupted",
    "empty",
    "disk full",
  ]) {
    const e = env();
    e.files.delete(binary);
    e.sandbox.fetch = async () => {
      if (failure === "network offline") throw new Error(failure);
      return {
        ok: failure !== "HTTP 503",
        status: 503,
        statusText: "Unavailable",
        arrayBuffer: async () => {
          if (failure === "body interrupted") throw new Error(failure);
          return new Uint8Array(failure === "empty" ? [] : [77, 90]).buffer;
        },
      };
    };
    if (failure === "disk full")
      e.sandbox.IOUtils.write = async () => {
        throw new Error(failure);
      };
    assert.equal(await e.api.downloadBinaryFile(), false);
    assert.equal(e.files.has(binary), false);
    assert.ok(e.notices.some((line) => line.type === "error"));
    if (failure !== "empty")
      assert.ok(e.notices.some((line) => line.text.includes(failure)));
    await e.api.copyFiles(["C:\\paper.pdf"]);
    assert.equal(e.executions.length, 0);
    assert.equal(succeeded(e), false);
  }
});

test("不存在复制程序时停止执行", async () => {
  const e = env();
  e.files.delete(binary);
  await e.api.copyFiles(["C:\\paper.pdf"]);
  assert.equal(e.executions.length, 0);
  assert.equal(succeeded(e), false);
});

test("非零退出或启动失败均显示原因，成功退出前不提示成功", async () => {
  const e = env();
  e.sandbox.Zotero.Utilities.Internal.exec = async () => {
    throw new Error("exit code 7");
  };
  await e.api.copyFiles(["C:\\paper.pdf"]);
  assert.equal(succeeded(e), false);
  assert.ok(e.notices.some((line) => line.text.includes("exit code 7")));
  let finish;
  e.sandbox.Zotero.Utilities.Internal.exec = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = e.api.copyFiles(["C:\\paper.pdf"]);
  await new Promise(setImmediate);
  assert.equal(succeeded(e), false);
  finish(true);
  await pending;
  assert.equal(succeeded(e), true);
});

test("文献中的托管与链接附件可复制，断链和 false 路径有反馈", async () => {
  const e = env();
  const stored = "C:\\Zotero\\storage\\ABCD\\中文 paper.pdf";
  const linked = "D:\\资料\\linked file.pdf";
  for (const file of [stored, linked]) e.files.set(file, new Uint8Array([1]));
  e.items.set(1, attachment(stored));
  e.items.set(2, attachment(linked));
  e.items.set(3, attachment(false));
  e.items.set(4, attachment("D:\\missing.pdf"));
  e.items.set(5, attachment(false, false));
  await e.api.copyItems([regular([1, 2, 3, 4, 5])]);
  assert.deepEqual(e.executions[0].paths, [stored, linked]);
  assert.ok(
    e.notices.some((line) => /2/.test(line.text) && /缺失/.test(line.text)),
  );
  assert.equal(succeeded(e), true);
});

test("空选择、网址附件、笔记、无附件文献和全部断链均不启动复制", async () => {
  for (const selection of [
    [],
    [attachment(false, false)],
    [regular([])],
    [attachment(false)],
    [attachment("D:\\missing.pdf")],
    [{ isAttachment: () => false, isRegularItem: () => false }],
  ]) {
    const e = env();
    await e.api.copyItems(selection);
    assert.equal(e.executions.length, 0);
    assert.ok(e.notices.some((line) => line.type === "error"));
  }
});

test("独立阅读器与后台标签的右键菜单始终复制事件附件", async () => {
  const e = env();
  const file = "D:\\reader.pdf";
  e.files.set(file, new Uint8Array([1]));
  e.items.set(1, attachment("D:\\wrong-main-tab.pdf"));
  e.items.set(2, attachment(file));
  e.ui.UIExampleFactory.registerRightClickReadViewer();
  let command;
  e.listeners[0]({
    reader: { itemID: 2 },
    append: (menu) => {
      command = menu.onCommand;
    },
  });
  // 弹出菜单后，主窗口切换标签也不能改变复制对象。
  e.sandbox.Zotero.Reader.getByTabID = () => {
    throw new Error("不能读取主窗口标签");
  };
  await command();
  assert.deepEqual(e.executions[0].paths, [file]);
  await e.menus[0].menus[0].onCommand({}, { items: [e.items.get(2)] });
  assert.deepEqual(e.executions[1].paths, [file]);
});

test("保留文献列表及快捷键入口", async () => {
  const e = env();
  const file = "D:\\selected.pdf";
  e.files.set(file, new Uint8Array([1]));
  e.items.set(1, attachment(file));
  e.ui.UIExampleFactory.registerRightClickMenuItem();
  await e.menus[0].commandListener({});
  e.prefs.set("enable-copy-shortcut", true);
  e.ui.KeyExampleFactory.registerShortcuts();
  await e.listeners[0]({}, { keyboard: { equals: () => true } });
  e.sandbox.Zotero.Reader.getByTabID = () => null;
  await e.listeners[0]({}, { keyboard: { equals: () => true } });
  assert.equal(e.executions.length, 3);
  for (const execution of e.executions)
    assert.deepEqual(execution.paths, [file]);
});
