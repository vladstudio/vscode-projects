#!/bin/bash
npm run compile && npx @vscode/vsce package --allow-missing-repository --skip-license && code --install-extension "$(ls -t *.vsix | head -1)" && echo "Installed. Reload VS Code windows to activate."
