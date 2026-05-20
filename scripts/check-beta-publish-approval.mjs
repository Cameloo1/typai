import { existsSync, readFileSync } from "node:fs";

const approvalPath = "release/beta-approval.json";
const docsPath = "docs/beta-publish-approval.md";
const allowedStatuses = new Set(["pending", "approved", "rejected"]);
const failures = [];

if (!existsSync(docsPath)) {
  failures.push(`Missing human-readable approval record: ${docsPath}`);
}

if (!existsSync(approvalPath)) {
  failures.push(`Missing structured approval record: ${approvalPath}`);
  finish();
}

const record = readJson(approvalPath);
const approval = record.manualApproval ?? {};

if (!allowedStatuses.has(approval.approvalStatus)) {
  failures.push(
    `approvalStatus must be one of ${[...allowedStatuses].join(", ")}; found ${String(
      approval.approvalStatus,
    )}.`,
  );
}

if (approval.approvalStatus !== "approved") {
  failures.push(`approvalStatus is ${String(approval.approvalStatus)}; expected approved.`);
}

if (isBlank(approval.approvedVersion)) {
  failures.push("approvedVersion is missing.");
}

if (isBlank(approval.approvedDistTag)) {
  failures.push("approvedDistTag is missing.");
}

if (isBlank(approval.approvedGitTag)) {
  failures.push("approvedGitTag is missing.");
}

if (!isNonEmptyArray(approval.approvedPackageSet)) {
  failures.push("approvedPackageSet is missing.");
}

if (!isNonEmptyArray(approval.approvedPublishOrder)) {
  failures.push("approvedPublishOrder is missing.");
}

if (isBlank(approval.approvedAssetStatus)) {
  failures.push("approvedAssetStatus is missing.");
} else if (
  !/blocked/i.test(approval.approvedAssetStatus) ||
  !/host-provided/i.test(approval.approvedAssetStatus)
) {
  failures.push("approvedAssetStatus must acknowledge blocked / host-provided-only asset status.");
}

if (isBlank(approval.approvedRollbackPlan)) {
  failures.push("approvedRollbackPlan is missing.");
}

if (!isNonEmptyArray(record.packagePublishSet)) {
  failures.push("packagePublishSet is missing from the approval record.");
}

if (!isNonEmptyArray(record.packagePublishOrder)) {
  failures.push("packagePublishOrder is missing from the approval record.");
}

if (record.productionLanguageAssetStatus?.status !== "blocked") {
  failures.push("productionLanguageAssetStatus.status must be blocked.");
}

if (record.productionLanguageAssetStatus?.mode !== "host-provided-only") {
  failures.push("productionLanguageAssetStatus.mode must be host-provided-only.");
}

if (record.productionLanguageAssetStatus?.productionDictionaryBundled !== false) {
  failures.push("productionDictionaryBundled must be false.");
}

if (record.productionLanguageAssetStatus?.productionFrequencyBundled !== false) {
  failures.push("productionFrequencyBundled must be false.");
}

if (record.productionLanguageAssetStatus?.rawSourceFilesBundled !== false) {
  failures.push("rawSourceFilesBundled must be false.");
}

if (approval.approvalStatus === "approved") {
  validateApprovedValues();
}

finish();

function validateApprovedValues() {
  if (approval.approvedVersion !== record.targetVersion) {
    failures.push(`approvedVersion must match targetVersion ${record.targetVersion}.`);
  }

  if (approval.approvedDistTag !== record.targetDistTag) {
    failures.push(`approvedDistTag must match targetDistTag ${record.targetDistTag}.`);
  }

  if (approval.approvedGitTag !== record.targetGitTag) {
    failures.push(`approvedGitTag must match targetGitTag ${record.targetGitTag}.`);
  }

  if (!sameStringArray(approval.approvedPackageSet, record.packagePublishSet)) {
    failures.push("approvedPackageSet must match packagePublishSet exactly.");
  }

  if (!sameStringArray(approval.approvedPublishOrder, record.packagePublishOrder)) {
    failures.push("approvedPublishOrder must match packagePublishOrder exactly.");
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`Could not parse ${path}: ${error.message}`);
    finish();
  }
}

function isBlank(value) {
  return typeof value !== "string" || value.trim().length === 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function sameStringArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function finish() {
  if (failures.length > 0) {
    console.error("Beta publish approval check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Beta publish approval check passed.");
  console.log(`Approved version: ${approval.approvedVersion}`);
  console.log(`Approved dist-tag: ${approval.approvedDistTag}`);
  console.log(`Approved Git tag: ${approval.approvedGitTag}`);
}
