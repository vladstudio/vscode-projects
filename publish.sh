#!/bin/bash
npm version patch --no-git-tag-version && npm run compile && npx @vscode/vsce publish
