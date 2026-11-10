#!/usr/bin/env bash
set -euo pipefail

# Fail if tracked repository content includes common customer/legal document formats
# or is stored in directories reserved for private runtime/customer data.
bad=0
while IFS= read -r -d '' path; do
  lower="${path,,}"
  case "$lower" in
    *.pdf|*.doc|*.docx|*.odt|*.rtf|*.xls|*.xlsx|*.ppt|*.pptx)
      printf 'BLOCKED: document file tracked in repository: %s\n' "$path"
      bad=1
      ;;
  esac
  case "/$lower/" in
    */uploads/*|*/storage/*|*/private-data/*|*/case-files/*|*/matter-files/*|*/evidence/*|*/customer-documents/*|*/legal-documents/*|*/backups/*|*/exports/*)
      printf 'BLOCKED: private/customer data path tracked in repository: %s\n' "$path"
      bad=1
      ;;
  esac
done < <(git ls-files -z)

if [[ "$bad" -ne 0 ]]; then
  echo "Repository content policy failed. Remove the data from Git and investigate its exposure."
  exit 1
fi

echo "Repository content policy passed."
