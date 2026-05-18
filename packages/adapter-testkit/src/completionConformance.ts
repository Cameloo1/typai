import { describe, expect, it } from "vitest";

import {
  COMPLETION_CONFORMANCE_FIXTURES,
  sleep,
  waitForCompletionCondition,
} from "./completionFixtures";
import type {
  CompletionConformanceCapabilities,
  CompletionConformanceDriver,
  CompletionConformanceDriverFactory,
  CompletionConformanceOptions,
  CompletionCorrectionMarkProbe,
  CompletionCorrectionTransactionProbe,
} from "./completionTypes";

const defaultCapabilities: CompletionConformanceCapabilities = {
  exactRevert: true,
  selectionChangeDismiss: false,
  compositionDismiss: false,
  staleResponseDrop: false,
  providerError: true,
  blueCorrectionMarkCheck: false,
  correctionTransactionDismiss: false,
  metricsPrivacy: true,
};

const defaultSkipReasons: Record<keyof CompletionConformanceCapabilities, string> = {
  exactRevert: "driver does not expose revertLastCompletion()",
  selectionChangeDismiss: "driver cannot simulate editor selection changes",
  compositionDismiss: "driver cannot simulate compositionstart in this unit environment",
  staleResponseDrop: "driver cannot force a stale provider response in this harness",
  providerError: "driver cannot force a provider error in this harness",
  blueCorrectionMarkCheck: "driver does not expose correction mark inspection",
  correctionTransactionDismiss:
    "driver cannot trigger a correction transaction while ghost is visible",
  metricsPrivacy: "driver does not expose completion metrics",
};

export function runCompletionConformanceSuite(
  driverFactory: CompletionConformanceDriverFactory,
  options: CompletionConformanceOptions = {},
): void {
  const capabilities = {
    ...defaultCapabilities,
    ...options.capabilities,
  };
  const skipReasons = {
    ...defaultSkipReasons,
    ...options.skipReasons,
  };
  const suiteName = options.suiteName ?? "typai completion conformance";

  describe(suiteName, () => {
    it("documents unsupported optional completion capabilities", () => {
      const unsupported = Object.entries(capabilities).filter(
        ([, supported]) => supported === false,
      ) as Array<[keyof CompletionConformanceCapabilities, boolean]>;

      for (const [capability] of unsupported) {
        expect(skipReasons[capability]).toEqual(expect.any(String));
        expect(skipReasons[capability]?.trim().length).toBeGreaterThan(0);
      }
    });

    it("shows ghost text after debounce and mocked provider response", async () => {
      await withDriver(driverFactory, async (driver) => {
        await showGhost(driver);

        expect(driver.isGhostVisible()).toBe(true);
        expect(driver.getGhostText()).toBe(COMPLETION_CONFORMANCE_FIXTURES.ghostText);
      });
    });

    it("keeps ghost text out of source text before accept", async () => {
      await withDriver(driverFactory, async (driver) => {
        await showGhost(driver);

        expect(driver.getText()).toBe(COMPLETION_CONFORMANCE_FIXTURES.promptText);
        expect(driver.getText()).not.toContain(COMPLETION_CONFORMANCE_FIXTURES.ghostText);
      });
    });

    it("accepts ghost text with Tab", async () => {
      await withDriver(driverFactory, async (driver) => {
        await showGhost(driver);
        await driver.pressTab();

        expect(driver.isGhostVisible()).toBe(false);
      });
    });

    it("turns accepted completion text into source text", async () => {
      await withDriver(driverFactory, async (driver) => {
        await showGhost(driver);
        await driver.pressTab();

        expect(driver.getText()).toBe(
          `${COMPLETION_CONFORMANCE_FIXTURES.promptText}${COMPLETION_CONFORMANCE_FIXTURES.ghostText}`,
        );
      });
    });

    it("records an accepted completion transaction", async () => {
      await withDriver(driverFactory, async (driver) => {
        await showGhost(driver);
        await driver.pressTab();

        const transactions = driver.getCompletionTransactions();

        expect(transactions).toHaveLength(1);
        expect(JSON.stringify(transactions[0])).toContain(
          COMPLETION_CONFORMANCE_FIXTURES.ghostText,
        );
      });
    });

    it.skipIf(!capabilities.exactRevert)(
      "exactly reverts an accepted completion transaction",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          if (driver.revertLastCompletion === undefined) {
            throw new Error(`${driver.name} did not provide revertLastCompletion().`);
          }

          await showGhost(driver);
          await driver.pressTab();
          await driver.revertLastCompletion();

          expect(driver.getText()).toBe(COMPLETION_CONFORMANCE_FIXTURES.promptText);
          expect(driver.isGhostVisible()).toBe(false);
        });
      },
    );

    it("dismisses ghost text with Escape", async () => {
      await withDriver(driverFactory, async (driver) => {
        await showGhost(driver);
        await driver.pressEscape();

        expect(driver.isGhostVisible()).toBe(false);
        expect(driver.getText()).toBe(COMPLETION_CONFORMANCE_FIXTURES.promptText);
      });
    });

    it("dismisses ghost text when the user keeps typing", async () => {
      await withDriver(driverFactory, async (driver) => {
        await showGhost(driver);
        await driver.typeText(COMPLETION_CONFORMANCE_FIXTURES.typingDismissText);

        expect(driver.isGhostVisible()).toBe(false);
        expect(driver.getText()).toBe(
          `${COMPLETION_CONFORMANCE_FIXTURES.promptText}${COMPLETION_CONFORMANCE_FIXTURES.typingDismissText}`,
        );
      });
    });

    it.skipIf(!capabilities.selectionChangeDismiss)(
      "dismisses ghost text on selection change where supported",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          if (driver.changeSelection === undefined) {
            throw new Error(`${driver.name} did not provide changeSelection().`);
          }

          await showGhost(driver);
          await driver.changeSelection();

          expect(driver.isGhostVisible()).toBe(false);
          expect(driver.getText()).toBe(COMPLETION_CONFORMANCE_FIXTURES.promptText);
        });
      },
    );

    it.skipIf(!capabilities.compositionDismiss)(
      "dismisses or suppresses ghost text on compositionstart where supported",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          if (driver.startComposition === undefined) {
            throw new Error(`${driver.name} did not provide startComposition().`);
          }

          await showGhost(driver);
          await driver.startComposition();

          expect(driver.isGhostVisible()).toBe(false);
          expect(driver.getText()).toBe(COMPLETION_CONFORMANCE_FIXTURES.promptText);
        });
      },
    );

    it.skipIf(!capabilities.staleResponseDrop)(
      "drops stale provider responses where supported",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          await driver.reset();
          await driver.typeText(COMPLETION_CONFORMANCE_FIXTURES.stalePromptText);
          await sleep(10);
          await driver.typeText(COMPLETION_CONFORMANCE_FIXTURES.stalePromptUpdateText);
          await driver.waitForGhostText(COMPLETION_CONFORMANCE_FIXTURES.ghostText);
          await waitForMetricType(driver, "stale_response_dropped");

          expect(driver.getGhostText()).toBe(COMPLETION_CONFORMANCE_FIXTURES.ghostText);
          expect(driver.getGhostText()).not.toBe(COMPLETION_CONFORMANCE_FIXTURES.staleGhostText);
          expect(driver.getText()).toBe(
            `${COMPLETION_CONFORMANCE_FIXTURES.stalePromptText}${COMPLETION_CONFORMANCE_FIXTURES.stalePromptUpdateText}`,
          );
        });
      },
    );

    it.skipIf(!capabilities.providerError)(
      "does not mutate text when the provider errors",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          await driver.reset();
          await driver.typeText(COMPLETION_CONFORMANCE_FIXTURES.providerErrorText);
          await waitForMetricType(driver, "provider_error");

          expect(driver.isGhostVisible()).toBe(false);
          expect(driver.getText()).toBe(COMPLETION_CONFORMANCE_FIXTURES.providerErrorText);
          expect(driver.getCompletionTransactions()).toHaveLength(0);
        });
      },
    );

    it.skipIf(!capabilities.blueCorrectionMarkCheck)(
      "does not create a blue correction mark when accepting completion",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          await showGhost(driver);
          await driver.pressTab();

          const marks = getCorrectionMarks(driver);
          const serializedMarks = JSON.stringify(marks);

          expect(serializedMarks).not.toContain("blue_applied_correction");
        });
      },
    );

    it.skipIf(!capabilities.correctionTransactionDismiss)(
      "dismisses ghost text when a correction transaction occurs where supported",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          await showGhost(driver);
          await triggerCorrectionTransaction(driver);

          expect(driver.isGhostVisible()).toBe(false);
        });
      },
    );

    it.skipIf(!capabilities.metricsPrivacy)(
      "does not put raw prompt context in default metrics",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          await driver.reset();
          await driver.typeText(COMPLETION_CONFORMANCE_FIXTURES.metricsPrivateText);
          await driver.waitForGhostText(COMPLETION_CONFORMANCE_FIXTURES.ghostText);

          const metrics = driver.getCompletionMetrics?.();

          expect(metrics).toEqual(expect.any(Array));
          expect(JSON.stringify(metrics)).not.toContain(
            COMPLETION_CONFORMANCE_FIXTURES.metricsPrivateText,
          );
        });
      },
    );
  });
}

async function showGhost(driver: CompletionConformanceDriver): Promise<void> {
  await driver.reset();
  await driver.typeText(COMPLETION_CONFORMANCE_FIXTURES.promptText);
  await driver.waitForGhostText(COMPLETION_CONFORMANCE_FIXTURES.ghostText);
}

async function withDriver(
  driverFactory: CompletionConformanceDriverFactory,
  run: (driver: CompletionConformanceDriver) => Promise<void> | void,
): Promise<void> {
  const driver = await driverFactory();

  await driver.setup();

  try {
    await driver.reset();
    await run(driver);
  } finally {
    await driver.teardown();
  }
}

async function waitForMetricType(
  driver: CompletionConformanceDriver,
  metricType: string,
): Promise<void> {
  if (driver.getCompletionMetrics === undefined) {
    await sleep(20);
    return;
  }

  await waitForCompletionCondition(
    () =>
      driver.getCompletionMetrics?.().some((event) => isMetricEventWithType(event, metricType)) ??
      false,
    `${driver.name} did not record completion metric ${metricType}.`,
  );
}

function isMetricEventWithType(event: unknown, metricType: string): boolean {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    (event as { type?: unknown }).type === metricType
  );
}

function getCorrectionMarks(driver: CompletionConformanceDriver): unknown[] {
  const markProbe = driver as CompletionConformanceDriver & Partial<CompletionCorrectionMarkProbe>;

  if (markProbe.getCorrectionMarks === undefined) {
    throw new Error(`${driver.name} did not provide getCorrectionMarks().`);
  }

  return markProbe.getCorrectionMarks();
}

async function triggerCorrectionTransaction(driver: CompletionConformanceDriver): Promise<void> {
  const transactionProbe = driver as CompletionConformanceDriver &
    Partial<CompletionCorrectionTransactionProbe>;

  if (transactionProbe.triggerCorrectionTransaction !== undefined) {
    await transactionProbe.triggerCorrectionTransaction();
    return;
  }

  await driver.typeText(COMPLETION_CONFORMANCE_FIXTURES.correctionDismissText);
}
