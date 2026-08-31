/**
 * Smoke test proving the `bun test` harness runs for the Step 2 WebGL engine.
 *
 * Later features add real unit tests (store diff-apply, free-list slot
 * recycling, scoring -> visual mapping). This trivial test exists only to
 * confirm the runner and the co-located `*.test.ts` convention work.
 */
import { describe, expect, it } from "bun:test";

/** Sentinel constant asserted by the harness smoke test. */
export const HARNESS_READY = true;

describe("bun test harness", () => {
  it("runs and asserts an exported constant", () => {
    expect(HARNESS_READY).toBe(true);
  });

  it("supports basic arithmetic sanity", () => {
    expect(1 + 1).toBe(2);
  });
});
