import { describe, expect, it } from "vitest";

import {
  expectBlueMark,
  expectNoBlueMarks,
  expectNoTransactions,
  expectPlainSourceText,
  expectRedMark,
} from "./assertions";
import type {
  AdapterConformanceCapabilities,
  AdapterConformanceDriver,
  AdapterConformanceDriverFactory,
  AdapterConformanceOptions,
} from "./types";

const defaultCapabilities: AdapterConformanceCapabilities = {
  blueRevert: true,
  redSuggestionApply: false,
  compositionGuard: false,
  staleWriteSimulation: false,
  plainSourceText: false,
  codeBlockProtection: false,
  completionSurfaceCheck: true,
};

const defaultSkipReasons: Record<keyof AdapterConformanceCapabilities, string> = {
  blueRevert: "driver does not expose a blue-mark revert action",
  redSuggestionApply: "driver does not expose a red-suggestion apply action",
  compositionGuard: "driver cannot simulate IME composition in this unit environment",
  staleWriteSimulation: "driver cannot force an explicit stale-write race in this test harness",
  plainSourceText: "driver source is not a textarea-like plain-text field",
  codeBlockProtection: "driver does not model Markdown/code-block contexts",
  completionSurfaceCheck: "driver does not expose completion-surface introspection",
};

export function runAdapterConformanceSuite(
  driverFactory: AdapterConformanceDriverFactory,
  options: AdapterConformanceOptions = {},
): void {
  const capabilities = {
    ...defaultCapabilities,
    ...options.capabilities,
  };
  const skipReasons = {
    ...defaultSkipReasons,
    ...options.skipReasons,
  };
  const suiteName = options.suiteName ?? `${options.kind ?? "typai"} adapter conformance`;

  describe(suiteName, () => {
    it("documents unsupported optional conformance capabilities", () => {
      const unsupported = Object.entries(capabilities).filter(
        ([, supported]) => supported === false,
      ) as Array<[keyof AdapterConformanceCapabilities, boolean]>;

      for (const [capability] of unsupported) {
        expect(skipReasons[capability]).toEqual(expect.any(String));
        expect(skipReasons[capability]?.trim().length).toBeGreaterThan(0);
      }
    });

    it("corrects a common typo and creates a blue mark", async () => {
      await withDriver(driverFactory, async (driver) => {
        await driver.typeText("teh ");

        expect(driver.getText()).toContain("the ");
        const mark = expectBlueMark(driver.getMarks());

        expect(driver.getText().slice(mark.range.start, mark.range.end)).toBe("the");
        expect(driver.getTransactions()).toHaveLength(1);
        expect(driver.getTransactions()[0]).toMatchObject({
          rangeBefore: { start: 0, end: 3, text: "teh" },
          rangeAfter: { start: 0, end: 3, text: "the" },
          original: "teh",
          replacement: "the",
          trigger: "space",
        });
      });
    });

    it.skipIf(!capabilities.blueRevert)(
      "reverts a blue mark to the exact original text",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          await driver.typeText("teh ");

          if (driver.revertFirstBlueMark === undefined) {
            throw new Error(`${driver.name} did not provide revertFirstBlueMark().`);
          }

          await driver.revertFirstBlueMark();

          expect(driver.getText()).toBe("teh ");
          expectNoBlueMarks(driver.getMarks());
        });
      },
    );

    it("marks an unresolved spelling issue without changing source text", async () => {
      await withDriver(driverFactory, async (driver) => {
        await driver.typeText("zzzzword ");

        expect(driver.getText()).toBe("zzzzword ");
        const mark = expectRedMark(driver.getMarks());

        expect(driver.getText().slice(mark.range.start, mark.range.end)).toBe("zzzzword");
        expectNoTransactions(driver.getTransactions());
      });
    });

    it("does not correct a valid word", async () => {
      await withDriver(driverFactory, async (driver) => {
        await driver.typeText("form ");

        expect(driver.getText()).toBe("form ");
        expect(driver.getMarks()).toHaveLength(0);
        expectNoBlueMarks(driver.getMarks());
        expectNoTransactions(driver.getTransactions());
      });
    });

    it.each([
      ["email", "user@example.com "],
      ["path", "/etc/passwd "],
      ["identifier", "snake_case_identifier "],
      ["CVE", "CVE-2024-1234 "],
    ])("does not correct protected %s tokens", async (_label, text) => {
      await withDriver(driverFactory, async (driver) => {
        await driver.typeText(text);

        expect(driver.getText()).toBe(text);
        expect(driver.getMarks()).toHaveLength(0);
        expectNoBlueMarks(driver.getMarks());
        expectNoTransactions(driver.getTransactions());
      });
    });

    it.skipIf(!capabilities.compositionGuard)(
      "prevents correction during active IME composition",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          if (driver.setComposition === undefined) {
            throw new Error(`${driver.name} did not provide setComposition().`);
          }

          await driver.setComposition(true);
          await driver.typeText("teh ");

          expect(driver.getText()).toBe("teh ");
          expectNoBlueMarks(driver.getMarks());
          expectNoTransactions(driver.getTransactions());

          await driver.setComposition(false);
        });
      },
    );

    it.skipIf(!capabilities.staleWriteSimulation)(
      "does not mutate text when an explicit stale write is simulated",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          if (driver.simulateStaleWrite === undefined) {
            throw new Error(`${driver.name} did not provide simulateStaleWrite().`);
          }

          await driver.simulateStaleWrite();

          expect(driver.getText()).not.toBe("the ");
          expectNoBlueMarks(driver.getMarks());
          expectNoTransactions(driver.getTransactions());
        });
      },
    );

    it("keeps edit-distance suggestions out of autocorrect", async () => {
      await withDriver(driverFactory, async (driver) => {
        await driver.typeText("reciept ");

        expect(driver.getText()).toBe("reciept ");
        const mark = expectRedMark(driver.getMarks());

        expect(mark.original).toBe("reciept");
        expect(mark.suggestions ?? []).toContain("receipt");
        expectNoBlueMarks(driver.getMarks());
        expectNoTransactions(driver.getTransactions());
      });
    });

    it.skipIf(!capabilities.redSuggestionApply)(
      "applies the first red suggestion through the adapter action",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          if (driver.chooseFirstRedSuggestion === undefined) {
            throw new Error(`${driver.name} did not provide chooseFirstRedSuggestion().`);
          }

          await driver.typeText("reciept ");
          await driver.chooseFirstRedSuggestion();

          expect(driver.getText()).toBe("receipt ");
          const mark = expectBlueMark(driver.getMarks());

          expect(mark.original).toBe("reciept");
          expect(mark.replacement).toBe("receipt");
          expect(driver.getTransactions()).toHaveLength(1);
          expect(driver.getTransactions()[0]).toMatchObject({
            original: "reciept",
            replacement: "receipt",
          });
        });
      },
    );

    it.skipIf(!capabilities.plainSourceText)(
      "does not insert markup into source text",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          await driver.typeText("teh ");

          expect(driver.getText()).toBe("the ");
          expectPlainSourceText(driver.getText());
        });
      },
    );

    it.skipIf(!capabilities.codeBlockProtection)(
      "does not correct or mark inside fenced code blocks",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          await driver.typeText("```ts\nteh ");

          expect(driver.getText()).toBe("```ts\nteh ");
          expect(driver.getMarks()).toHaveLength(0);
          expectNoTransactions(driver.getTransactions());
        });
      },
    );

    it.skipIf(!capabilities.completionSurfaceCheck)(
      "does not expose ghost text or remote completion behavior",
      async () => {
        await withDriver(driverFactory, async (driver) => {
          if (
            driver.hasGhostTextCompletion === undefined ||
            driver.hasRemoteCompletionPath === undefined
          ) {
            throw new Error(
              `${driver.name} did not provide completion surface conformance methods.`,
            );
          }

          await driver.typeText("zzzzword ");

          expect(driver.hasGhostTextCompletion()).toBe(false);
          expect(driver.hasRemoteCompletionPath()).toBe(false);
        });
      },
    );
  });
}

async function withDriver(
  driverFactory: AdapterConformanceDriverFactory,
  run: (driver: AdapterConformanceDriver) => Promise<void> | void,
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
