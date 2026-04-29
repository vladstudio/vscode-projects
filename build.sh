#!/bin/bash
set -e
code --uninstall-extension vladstudio.vladstudio-projects || true
rm vladstudio-projects-*.vsix
bun run compile
vsce package
code --install-extension vladstudio-projects-*.vsix
