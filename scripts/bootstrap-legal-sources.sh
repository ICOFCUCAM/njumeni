#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/third-party/legal-open-source"
mkdir -p "$DEST"

clone_or_keep() {
  local name="$1"
  local url="$2"
  local target="$DEST/$name"

  if [[ -d "$target/.git" ]]; then
    echo "Keeping existing checkout: $name"
  elif [[ -e "$target" ]]; then
    echo "Refusing to overwrite non-Git path: $target" >&2
    return 1
  else
    git clone --origin upstream "$url" "$target"
  fi
}

clone_or_keep "OpenContracts" "https://github.com/Open-Source-Legal/OpenContracts.git"
clone_or_keep "CaseCite" "https://github.com/thomasunise/casecite.git"
clone_or_keep "Lawgent" "https://github.com/heyutkarshverma/Lawgent.git"
clone_or_keep "Lovspor" "https://github.com/bartoszkobylinski/lovspor.git"
clone_or_keep "Mike" "https://github.com/open-legal-products/mike.git"

echo
echo "Source checkouts are available in: $DEST"
echo "Review licences and upstream commits before reusing code."
