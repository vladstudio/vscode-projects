import * as vscode from "vscode";
import * as path from "path";

const MIME = "application/vnd.code.tree.projectsView";
const KEY = "projects.folders";

let folders: string[] = [];
let state: vscode.Memento;
const emitter = new vscode.EventEmitter<void>();

function save() {
  state.update(KEY, folders);
  emitter.fire();
}

function openFolder(fsPath: string) {
  vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(fsPath), { forceNewWindow: false });
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

const treeProvider: vscode.TreeDataProvider<string> & vscode.TreeDragAndDropController<string> = {
  onDidChangeTreeData: emitter.event,
  dropMimeTypes: [MIME],
  dragMimeTypes: [MIME],

  getTreeItem(fsPath: string) {
    return new FolderItem(fsPath);
  },

  getChildren() {
    return folders;
  },

  getParent() {
    return undefined;
  },

  handleDrag(sources: readonly string[], data: vscode.DataTransfer) {
    data.set(MIME, new vscode.DataTransferItem(sources[0]));
  },

  handleDrop(target: string | undefined, data: vscode.DataTransfer) {
    const source = data.get(MIME)?.value as string | undefined;
    if (!source) return;
    const fromIdx = folders.indexOf(source);
    if (fromIdx === -1) return;
    folders.splice(fromIdx, 1);
    const toIdx = target ? folders.indexOf(target) : folders.length;
    folders.splice(toIdx === -1 ? folders.length : toIdx, 0, source);
    save();
  },
};

export function activate(ctx: vscode.ExtensionContext) {
  const iconUri = vscode.Uri.joinPath(ctx.extensionUri, "icon", "workspaces.svg");
  iconPath = { light: iconUri, dark: iconUri };
  state = ctx.globalState;
  folders = state.get<string[]>(KEY, []);

  const tree = vscode.window.createTreeView("projectsView", {
    treeDataProvider: treeProvider,
    dragAndDropController: treeProvider,
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
