#!/bin/bash
set -e
codium --uninstall-extension vladstudio.vladstudio-projects || true
rm vladstudio-projects-*.vsix
bun run compile
vsce package
codium --install-extension vladstudio-projects-*.vsix
