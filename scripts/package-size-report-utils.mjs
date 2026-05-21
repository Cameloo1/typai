export const defaultPackageSizeThresholds = {
  packageWarningBytes: 512 * 1024,
  packageFailBytes: 2 * 1024 * 1024,
  blockedCoreWarningBytes: 256 * 1024,
  blockedCoreFailBytes: 1024 * 1024,
  productionAssetTargetBytes: 2 * 1024 * 1024,
  productionAssetFailBytes: 8 * 1024 * 1024,
};

export function createPackagePolicyReport({
  manifest,
  packageReports,
  thresholds = defaultPackageSizeThresholds,
}) {
  const productionStatus = manifest.review?.status ?? "unknown";
  const productionPackageInclusion = manifest.output?.packageInclusion ?? "unknown";
  const selectedDeliveryMode = selectDeliveryMode(manifest);
  const findings = [];
  const warnings = [];

  for (const report of packageReports) {
    validatePackageSize(report, {
      productionStatus,
      thresholds,
      warnings,
      findings,
    });
    validatePackedFiles(report, {
      productionStatus,
      productionPackageInclusion,
      thresholds,
      warnings,
      findings,
    });
  }

  return {
    production: {
      status: productionStatus,
      packageInclusion: productionPackageInclusion,
      selectedDeliveryMode,
    },
    thresholds,
    packages: packageReports,
    warnings,
    findings,
  };
}

export function selectDeliveryMode(currentManifest) {
  if (currentManifest.review?.status === "blocked") {
    return "host-provided-only; production-mode-blocked";
  }

  if (currentManifest.review?.status !== "approved") {
    return "unknown";
  }

  if (currentManifest.output?.packageInclusion === "committed-generated-binary") {
    return "bundled-in-core";
  }

  if (currentManifest.output?.packageInclusion === "generated-during-prepack") {
    return "generated-during-prepack";
  }

  if (currentManifest.output?.packageInclusion === "host-provided-only") {
    return "host-provided-only";
  }

  return currentManifest.output?.packageInclusion ?? "unknown";
}

export function isProductionAssetFile(path) {
  return (
    path.startsWith("assets/production/") ||
    /production.*dictionary/i.test(path) ||
    /production.*frequency/i.test(path)
  );
}

export function isProductionBinaryFile(path) {
  return (
    /production.*\.(?:bin|dictionary|frequency)$/i.test(path) ||
    /(?:^|\/)production-en-us\.dictionary\.bin$/i.test(path)
  );
}

export function isProductionNoticeFile(path) {
  return (
    path === "assets/production/MANIFEST.json" ||
    path === "assets/production/ATTRIBUTION.md" ||
    path.startsWith("assets/production/LICENSES/")
  );
}

export function isRawSourceFile(path) {
  return (
    /\.(?:aff|dic|gz|tsv|zip)$/i.test(path) ||
    /(?:^|\/)totalcounts-\d+$/i.test(path) ||
    /(?:^|\/)books-ngram/i.test(path)
  );
}

export function isInspectable(path) {
  return /\.(?:cjs|css|cts|d\.ts|html|js|json|mjs|mts|ts|txt|md)$/i.test(path);
}

function validatePackageSize(report, context) {
  const { productionStatus, thresholds, warnings, findings } = context;

  if (report.name === "@typai/core" && productionStatus === "blocked") {
    if (report.sizeBytes > thresholds.blockedCoreWarningBytes) {
      warnings.push(
        `${report.name} blocked-state tarball ${formatBytes(
          report.sizeBytes,
        )} exceeds warning threshold ${formatBytes(thresholds.blockedCoreWarningBytes)}`,
      );
    }

    if (report.sizeBytes > thresholds.blockedCoreFailBytes) {
      findings.push(
        `${report.name} blocked-state tarball ${formatBytes(
          report.sizeBytes,
        )} exceeds failure threshold ${formatBytes(thresholds.blockedCoreFailBytes)}`,
      );
    }

    return;
  }

  if (report.sizeBytes > thresholds.packageWarningBytes) {
    warnings.push(
      `${report.name} tarball ${formatBytes(report.sizeBytes)} exceeds warning threshold ${formatBytes(
        thresholds.packageWarningBytes,
      )}`,
    );
  }

  if (report.sizeBytes > thresholds.packageFailBytes) {
    findings.push(
      `${report.name} tarball ${formatBytes(report.sizeBytes)} exceeds failure threshold ${formatBytes(
        thresholds.packageFailBytes,
      )}`,
    );
  }
}

function validatePackedFiles(report, context) {
  const { productionStatus, productionPackageInclusion, thresholds, warnings, findings } = context;

  for (const file of report.files) {
    if (file.path.toLowerCase().includes(".env")) {
      findings.push(`${report.name} includes env-like file: ${file.path}`);
    }

    if (isRawSourceFile(file.path)) {
      findings.push(`${report.name} includes raw dictionary/frequency source file: ${file.path}`);
    }

    if (isProductionAssetFile(file.path) && productionStatus === "blocked") {
      findings.push(`${report.name} includes blocked production asset file: ${file.path}`);
    }
  }

  if (report.name !== "@typai/core") {
    return;
  }

  if (productionStatus === "blocked") {
    if (productionPackageInclusion !== "blocked") {
      findings.push(
        `blocked manifest must keep output.packageInclusion blocked, got ${productionPackageInclusion}`,
      );
    }

    for (const file of report.files) {
      if (file.path.startsWith("assets/")) {
        findings.push(
          `@typai/core includes assets/ while production manifest is blocked: ${file.path}`,
        );
      }
    }

    return;
  }

  if (productionStatus !== "approved") {
    findings.push(
      `production manifest review.status must be blocked or approved, got ${productionStatus}`,
    );
    return;
  }

  if (
    productionPackageInclusion === "committed-generated-binary" ||
    productionPackageInclusion === "generated-during-prepack"
  ) {
    requireCoreProductionNoticeFiles(report, findings);
    requireIncludedProductionBinary(report, findings);
    validateIncludedProductionAssetSize(report, { thresholds, warnings, findings });
  }
}

function requireCoreProductionNoticeFiles(report, findings) {
  const paths = new Set(report.files.map((file) => file.path));
  const required = [
    "assets/production/MANIFEST.json",
    "assets/production/ATTRIBUTION.md",
    "assets/production/LICENSES/README.md",
  ];

  for (const filePath of required) {
    if (!paths.has(filePath)) {
      findings.push(`@typai/core approved production inclusion is missing ${filePath}`);
    }
  }
}

function requireIncludedProductionBinary(report, findings) {
  if (report.productionBinaryFiles.length === 0) {
    findings.push("@typai/core approved production inclusion is missing generated binary asset.");
  }
}

function validateIncludedProductionAssetSize(report, context) {
  const { thresholds, warnings, findings } = context;
  const productionAssets = report.files.filter((file) => isProductionAssetFile(file.path));
  const totalProductionAssetBytes = productionAssets.reduce(
    (total, file) => total + file.sizeBytes,
    0,
  );

  if (totalProductionAssetBytes > thresholds.productionAssetTargetBytes) {
    warnings.push(
      `@typai/core production asset files total ${formatBytes(
        totalProductionAssetBytes,
      )}, above target ${formatBytes(thresholds.productionAssetTargetBytes)}`,
    );
  }

  if (totalProductionAssetBytes > thresholds.productionAssetFailBytes) {
    findings.push(
      `@typai/core production asset files total ${formatBytes(
        totalProductionAssetBytes,
      )}, above failure threshold ${formatBytes(thresholds.productionAssetFailBytes)}`,
    );
  }
}

function formatBytes(value) {
  if (!Number.isFinite(value)) {
    return "unknown";
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KiB`;
  }

  return `${value} B`;
}
