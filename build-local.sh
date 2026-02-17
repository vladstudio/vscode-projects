#!/bin/bash
npm run compile && npx @vscode/vsce package --allow-missing-repository --skip-license && code --install-extension workspaces-0.0.1.vsix && echo "Installed. Reload VS Code windows to activate."
