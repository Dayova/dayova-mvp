// Render both EAS and GitHub destinations from the same completed job context.
const after = JSON.parse(process.env.CI_OTA_CONTEXT);
const sha = process.env.CI_OTA_SOURCE_SHA;
const runUrl = process.env.CI_OTA_RUN_URL;
if (
	!after ||
	typeof after !== "object" ||
	!/^[a-f0-9]{40}$/.test(sha ?? "") ||
	!runUrl?.startsWith("https://expo.dev/")
)
	throw new Error("Incomplete PR OTA report provenance.");
const fingerprint = after.production_fingerprint;
const ota = after.ota_checks;
const title =
	ota?.status === "success" && ota.outputs?.ota_safe === "true"
		? "✅ OTA-compatible"
		: ota?.status === "success" && ota.outputs?.ota_safe === "false"
			? "⚠️ Not OTA-compatible"
			: "❓ Compatibility not confirmed";
const statusLabel = (status) =>
	status === "success"
		? "✅ Completed"
		: status === "failure"
			? "❌ Failed"
			: "⏭️ Not completed";
process.stdout.write(`<!-- dayova-ota-report -->
## 📱 OTA compatibility

**Checked commit:** \`${sha}\` · 🔎 [View EAS run](${runUrl})

**This report applies only to the checked commit.** If the PR's latest commit differs, this result is **outdated** and OTA compatibility for the latest commit is **unconfirmed** until this comment updates.

### ${title}

| Check | Status |
| --- | --- |
| 🧬 Native fingerprints | ${statusLabel(fingerprint?.status)} |
| 📦 iOS & Android exports + OTA assessment | ${statusLabel(ota?.status)} |

💡 **Advisory for merging.** Native changes can still merge. Nothing is published by this PR check; main rechecks the merged commit before publishing.

<details>
<summary>🛠️ Technical details — reason, builds & fingerprints</summary>

**Reason:** ${ota?.outputs?.ota_reason || "Assessment did not complete. Production checks run only for trusted, same-repository PRs after quality checks pass."}

**📦 Distributed builds:** \`${ota?.outputs?.ota_baseline || "Not assessed"}\`

**🧬 Current fingerprints**

| Platform | Fingerprint |
| --- | --- |
| iOS | \`${fingerprint?.outputs?.ios_fingerprint_hash || "Not assessed"}\` |
| Android | \`${fingerprint?.outputs?.android_fingerprint_hash || "Not assessed"}\` |

</details>
`);
