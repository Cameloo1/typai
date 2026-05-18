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
  compositionGuard: false,
  staleWriteSimulation: false,
  plainSourceText: false,
};

export function runAdapterConformanceSuite(
  driverFactory: AdapterConformanceDriverFactory,
  options: AdapterConformanceOptions = {},
): void {
  const capabilities = {
    ...defaultCapabilities,
    ...options.capabilities,
  };
  const suiteName = options.suiteName ?? `${options.kind ?? "typai"} adapter conformance`;

  describe(suiteName, () => {
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
        expectNoBlueMarks(driver.getMarks());
        expectNoTransactions(driver.getTransactions());
      });
    });

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
