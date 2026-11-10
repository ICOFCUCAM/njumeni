#!/usr/bin/env bash
set -euo pipefail

# Guard against committing live application records in runtime/customer-data
# directories. This does not prohibit Njumeni from handling confidential
# documents through its protected application storage.
bad=0
while IFS= read -r -d '' path; do
  lower="${path,,}"
  case "/$lower/" in
    */uploads/*|*/storage/*|*/data/*|*/private-data/*|*/case-files/*|*/matter-files/*|*/evidence/*|*/customer-documents/*|*/legal-documents/*|*/backups/*|*/exports/*)
      printf 'BLOCKED: runtime/customer-data path tracked in source repository: %s\n' "$path"
      bad=1
      ;;
  esac
done < <(git ls-files -z)

if [[ "$bad" -ne 0 ]]; then
  echo "Source repository content policy failed. Keep live application records in protected runtime storage, not Git."
  exit 1
fi

echo "Source repository content policy passed."
