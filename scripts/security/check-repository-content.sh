#!/usr/bin/env bash
set -euo pipefail

# Guard against committing live application records in runtime/customer-data
# directories. This does not prohibit Njumeni from handling confidential
# documents through its protected application storage.
#
# Application source code that merely *implements* evidence/storage features
# (for example apps/web/src/modules/evidence/pipeline.ts) is allowed; data files
# in those directories (documents, images, spreadsheets, archives, dumps) are not.
# Both tracked files and new, not-yet-tracked files are checked, so the local
# check catches what CI will catch.
bad=0
while IFS= read -r -d '' path; do
  lower="${path,,}"
  case "/$lower/" in
    */uploads/*|*/storage/*|*/data/*|*/private-data/*|*/case-files/*|*/matter-files/*|*/evidence/*|*/customer-documents/*|*/legal-documents/*|*/backups/*|*/exports/*)
      if [[ "$lower" =~ ^apps/[a-z0-9_-]+/(src|tests)/.+\.(ts|tsx|js|mjs|cjs|css)$ ]]; then
        continue
      fi
      printf 'BLOCKED: runtime/customer-data path tracked in source repository: %s\n' "$path"
      bad=1
      ;;
  esac
done < <(git ls-files -z --cached --others --exclude-standard)

if [[ "$bad" -ne 0 ]]; then
  echo "Source repository content policy failed. Keep live application records in protected runtime storage, not Git."
  exit 1
fi

echo "Source repository content policy passed."
