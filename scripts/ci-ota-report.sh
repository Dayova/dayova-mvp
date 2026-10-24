set -euo pipefail
ota_exit_code=0
if ota_report="$(node scripts/ota-safety.mjs --json)"; then
  ota_safe=true
else
  ota_exit_code=$?
  ota_safe=false
fi

# Validate the complete consumer contract before exposing any verdict.
OTA_REPORT="$ota_report" OTA_EXIT_CODE="$ota_exit_code" node -e '
  const report = JSON.parse(process.env.OTA_REPORT);
  if (!report || typeof report !== "object" ||
      typeof report.safe !== "boolean" ||
      ![null, "compatibility", "preflight"].includes(report.failureKind) ||
      report.safe !== (report.failureKind === null) ||
      Number(process.env.OTA_EXIT_CODE) !== (report.safe ? 0 : 1) ||
      ["reason", "baseline", "currentFingerprints"].some(key =>
        typeof report[key] !== "string" || report[key].trim() === "")) {
    throw new Error("Invalid or incomplete OTA safety report");
  }
'

printf '%s\n' "$ota_report"
ota_reason="$(OTA_REPORT="$ota_report" node -p 'JSON.parse(process.env.OTA_REPORT).reason.replace(/\b[a-f0-9]{40}\b/g, hash => "`" + hash + "`")')"
ota_baseline="$(OTA_REPORT="$ota_report" node -p 'JSON.parse(process.env.OTA_REPORT).baseline')"
ota_current_fingerprints="$(OTA_REPORT="$ota_report" node -p 'JSON.parse(process.env.OTA_REPORT).currentFingerprints')"
ota_failure_kind="$(OTA_REPORT="$ota_report" node -p 'JSON.parse(process.env.OTA_REPORT).failureKind')"

set-output ota_safe "$ota_safe"
set-output ota_reason "$ota_reason"
set-output ota_baseline "$ota_baseline"
set-output ota_current_fingerprints "$ota_current_fingerprints"

# Native incompatibility is advisory on PRs; an incomplete check is not.
set-output ota_failure_kind "$ota_failure_kind"
