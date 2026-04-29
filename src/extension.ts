import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const KEY = "projects.folders";
const byName = (a: string, b: string) => path.basename(a).localeCompare(path.basename(b));

let folders: string[] = [];
let state: vscode.Memento;
const emitter = new vscode.EventEmitter<void>();

function updateCurrentFolderContext() {
  const current = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  vscode.commands.executeCommand("setContext", "projects.currentFolderAdded", current ? folders.includes(current) : false);
}

function save() {
  folders.sort(byName);
  state.update(KEY, folders);
  emitter.fire();
  updateCurrentFolderContext();
}

function openFolder(fsPath: string) {
  vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(fsPath), { forceNewWindow: false });
}

function addFolderIfMissing(fsPath: string) {
  if (folders.includes(fsPath)) return false;
  folders.push(fsPath);
  return true;
}

let iconPath: { light: vscode.Uri; dark: vscode.Uri };

class FolderItem extends vscode.TreeItem {
  constructor(public fsPath: string) {
    super(path.basename(fsPath));
    this.description = fsPath;
    this.iconPath = iconPath;
    this.command = { command: "projects.openFolder", title: "Open", arguments: [fsPath] };
  }
}

const treeProvider: vscode.TreeDataProvider<string> = {
  onDidChangeTreeData: emitter.event,

  getTreeItem(fsPath: string) {
    return new FolderItem(fsPath);
  },

  getChildren() {
    return folders;
  },

  getParent() {
    return undefined;
  },
};

export function activate(ctx: vscode.ExtensionContext) {
  iconPath = {
    light: vscode.Uri.joinPath(ctx.extensionUri, "icon", "workspaces.svg"),
    dark: vscode.Uri.joinPath(ctx.extensionUri, "icon", "workspaces-dark.svg"),
  };
  state = ctx.globalState;
  folders = state.get<string[]>(KEY, []);
  folders.sort(byName);

  const dropController: vscode.TreeDragAndDropController<string> = {
    dropMimeTypes: ["text/uri-list"],
    dragMimeTypes: [],
    async handleDrop(_target, sources) {
      const uriList = await sources.get("text/uri-list")?.asString();
      if (!uriList) return;
      let changed = false;
      for (const line of uriList.split(/\r?\n/)) {
        if (!line || line.startsWith("#")) continue;
        const uri = vscode.Uri.parse(line.trim());
        if (uri.scheme === "file") {
          try { if (fs.statSync(uri.fsPath).isDirectory() && addFolderIfMissing(uri.fsPath)) changed = true; } catch {}
        }
      }
      if (changed) save();
    },
  };

  const tree = vscode.window.createTreeView("projectsView", {
    treeDataProvider: treeProvider,
    canSelectMany: false,
    dragAndDropController: dropController,
  });
  ctx.subscriptions.push(tree, emitter);
  updateCurrentFolderContext();

  ctx.subscriptions.push(
    vscode.commands.registerCommand("projects.addFolder", async () => {
      const uris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectMany: true });
      if (!uris) return;
      let changed = false;
      for (const uri of uris) if (addFolderIfMissing(uri.fsPath)) changed = true;
      if (changed) save();
    }),

    vscode.commands.registerCommand("projects.addCurrentFolder", () => {
      const currentFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!currentFolder) {
        vscode.window.showInformationMessage("No current folder to add.");
        return;
      }

      if (addFolderIfMissing(currentFolder)) {
        save();
        vscode.window.showInformationMessage(`Added project: ${path.basename(currentFolder)}`);
        return;
      }

      vscode.window.showInformationMessage(`Project already exists: ${path.basename(currentFolder)}`);
    }),

    vscode.commands.registerCommand("projects.cleanupFolders", () => {
      const before = folders.length;
      const nextFolders = folders.filter((f) => { try { return fs.statSync(f).isDirectory(); } catch { return false; } });
      const deletedCount = before - nextFolders.length;
      if (deletedCount === 0) {
        vscode.window.showInformationMessage("Cleanup complete: no missing folders found.");
        return;
      }

      folders = nextFolders;
      save();
      vscode.window.showInformationMessage(`Cleanup complete: removed ${deletedCount} missing project${deletedCount === 1 ? "" : "s"}.`);
    }),

    vscode.commands.registerCommand("projects.removeFolder", (fsPath: string) => {
      const idx = folders.indexOf(fsPath);
      if (idx !== -1) {
        folders.splice(idx, 1);
        save();
      }
    }),

    vscode.commands.registerCommand("projects.openFolder", openFolder),

    vscode.commands.registerCommand("projects.revealInFinder", (fsPath: string) => {
      vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(fsPath));
    }),

    vscode.commands.registerCommand("projects.openPicker", async () => {
      const items = folders.map((f) => ({ label: path.basename(f), description: f, fsPath: f }));
      const picked = await vscode.window.showQuickPick(items, { placeHolder: "Select project" });
      if (picked) openFolder(picked.fsPath);
    }),
  );
}

export function deactivate() {}
