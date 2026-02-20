# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `bun run compile` — Build the extension (TypeScript → `out/`)
- `bun run watch` — Build in watch mode
- Press F5 in VS Code to launch Extension Development Host

## Architecture

Minimal VS Code extension — a project switcher. All logic lives in a single file: `src/extension.ts`.

- **Storage**: `globalState` memento stores folder list as `string[]`. No file watchers or disk I/O.
- **Tree View**: Flat `TreeDataProvider` with `TreeDragAndDropController` for reordering. Elements are raw `string` paths.
- **Commands**: `addFolder`, `removeFolder`, `openFolder`, `openPicker`. All registered in `activate()`.
- **Activation**: Only on `onView:projectsView` or command invocation. Zero background work.
- **Keybinding**: `Cmd+Alt+P` opens the Quick Pick project switcher.

The extension manifest (`package.json`) defines the sidebar view container, menus, and keybindings declaratively.
