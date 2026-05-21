import { existsSync, readFileSync } from "node:fs";

const approvalPath = "release/beta-approval.json";
const docsPath = "docs/beta-publish-approval.md";
const allowedStatuses = new Set(["pending", "approved", "rejected"]);
const supportPackage = "@typai/ui";
const packagesDependingOnUi = new Set([
  "@typai/contenteditable",
  "@typai/textarea",
  "@typai/react",
  "@typai/codemirror",
]);
const rollbackPlanRequirements = [
  ["beta dist-tag remediation", /beta\s+dist-tag/i],
  ["beta patch publish", /beta\s+patch|0\.0\.0-beta\.1/i],
  ["bad beta deprecation", /deprecat/i],
  ["no public history rewrite", /no\s+history\s+rewrite|never\s+rewrite/i],
  ["production asset remains blocked", /production\s+asset/i],
];
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
} else {
  for (const [label, pattern] of rollbackPlanRequirements) {
    if (!pattern.test(approval.approvedRollbackPlan)) {
      failures.push(`approvedRollbackPlan must acknowledge ${label}.`);
    }
  }
}

if (!isNonEmptyArray(record.packagePublishSet)) {
  failures.push("packagePublishSet is missing from the approval record.");
} else {
  validateNoDuplicates(record.packagePublishSet, "packagePublishSet");
  validateUiSupport(record.packagePublishSet, "packagePublishSet");
}

if (!isNonEmptyArray(record.packagePublishOrder)) {
  failures.push("packagePublishOrder is missing from the approval record.");
} else {
  validateNoDuplicates(record.packagePublishOrder, "packagePublishOrder");
  if (
    isNonEmptyArray(record.packagePublishSet) &&
    !sameStringSet(record.packagePublishOrder, record.packagePublishSet)
  ) {
    failures.push("packagePublishOrder must contain the same packages as packagePublishSet.");
  }
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

  validateNoDuplicates(approval.approvedPackageSet, "approvedPackageSet");
  validateNoDuplicates(approval.approvedPublishOrder, "approvedPublishOrder");
  validateUiSupport(approval.approvedPackageSet, "approvedPackageSet");

  if (!sameStringSet(approval.approvedPublishOrder, approval.approvedPackageSet)) {
    failures.push("approvedPublishOrder must contain the same packages as approvedPackageSet.");
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

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function validateNoDuplicates(values, label) {
  if (!Array.isArray(values)) {
    return;
  }

  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      failures.push(`${label} contains duplicate package ${value}.`);
    }
    seen.add(value);
  }
}

function validateUiSupport(packageSet, label) {
  if (!Array.isArray(packageSet)) {
    return;
  }

  const packages = new Set(packageSet);
  const needsUi = [...packagesDependingOnUi].some((packageName) => packages.has(packageName));
  if (needsUi && !packages.has(supportPackage)) {
    failures.push(`${label} must include ${supportPackage} because public packages depend on it.`);
  }
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
