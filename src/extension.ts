import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const KEY = "projects.folders";
const byName = (a: string, b: string) => path.basename(a).localeCompare(path.basename(b));

let folders: string[] = [];
let state: vscode.Memento;
const emitter = new vscode.EventEmitter<void>();

function save() {
  folders.sort(byName);
  state.update(KEY, folders);
  emitter.fire();
}

function openFolder(fsPath: string) {
  vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(fsPath), { forceNewWindow: false });
}

function addFolderIfMissing(fsPath: string) {
  if (!folders.includes(fsPath)) {
    folders.push(fsPath);
    save();
    return true;
  }
  return false;
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
  const iconUri = vscode.Uri.joinPath(ctx.extensionUri, "icon", "workspaces.svg");
  iconPath = { light: iconUri, dark: iconUri };
  state = ctx.globalState;
  folders = state.get<string[]>(KEY, []);
  folders.sort(byName);

  const tree = vscode.window.createTreeView("projectsView", {
    treeDataProvider: treeProvider,
    canSelectMany: false,
  });
  ctx.subscriptions.push(tree, emitter);

  ctx.subscriptions.push(
    vscode.commands.registerCommand("projects.addFolder", async () => {
      const uris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectMany: true });
      if (!uris) return;
      for (const uri of uris) {
        if (!folders.includes(uri.fsPath)) folders.push(uri.fsPath);
      }
      save();
    }),

    vscode.commands.registerCommand("projects.addCurrentFolder", () => {
      const currentFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!currentFolder) {
        vscode.window.showInformationMessage("No current folder to add.");
        return;
      }

      const added = addFolderIfMissing(currentFolder);
      if (added) {
        vscode.window.showInformationMessage(`Added project: ${path.basename(currentFolder)}`);
        return;
      }

      vscode.window.showInformationMessage(`Project already exists: ${path.basename(currentFolder)}`);
    }),

    vscode.commands.registerCommand("projects.cleanupFolders", () => {
      const removedCount = folders.length;
      const nextFolders = folders.filter((folder) => {
        try {
          return fs.statSync(folder).isDirectory();
        } catch {
          return false;
        }
      });
      const deletedCount = removedCount - nextFolders.length;
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

    vscode.commands.registerCommand("projects.openFolder", (fsPath: string) => {
      openFolder(fsPath);
    }),

    vscode.commands.registerCommand("projects.openPicker", async () => {
      const items = folders.map((f) => ({ label: path.basename(f), description: f, fsPath: f }));
      const picked = await vscode.window.showQuickPick(items, { placeHolder: "Select project" });
      if (picked) openFolder(picked.fsPath);
    }),
  );
}

export function deactivate() {}
