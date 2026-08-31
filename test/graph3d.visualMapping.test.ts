import { describe, it, expect } from "bun:test";
import {
  resolveImpact,
  impactToScale,
  freshnessToEmissive,
  freshnessToTier,
  categoryToColorHex,
  deriveSentiment,
  sentimentToTintHex,
  ageToZDepth,
  freshnessToZDepth,
  writeCategoryColor,
  hexToRgb01,
} from "@/lib/graph3d/visualMapping";
import { LAYOUT } from "@/lib/graph3d/types";
import type { EconomicNode } from "@/lib/types";

function node(overrides: Partial<EconomicNode> = {}): EconomicNode {
  return {
    id: "n",
    articleId: "a",
    label: "n",
    category: "economic",
    ...overrides,
  };
}

describe("visualMapping - resolveImpact precedence", () => {
  it("prefers economicImpactScore, then val, then default 5", () => {
    expect(resolveImpact(node({ economicImpactScore: 8, val: 2 }))).toBe(8);
    expect(resolveImpact(node({ val: 2 }))).toBe(2);
    expect(resolveImpact(node({}))).toBe(5);
  });
});

describe("visualMapping - impactToScale monotonic", () => {
  it("is non-decreasing across the impact domain", () => {
    let prev = -Infinity;
    for (let i = 1; i <= 10; i++) {
      const s = impactToScale(i);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it("maps endpoints to MIN/MAX scale and clamps out-of-range", () => {
    expect(impactToScale(1)).toBeCloseTo(LAYOUT.MIN_SCALE, 5);
    expect(impactToScale(10)).toBeCloseTo(LAYOUT.MAX_SCALE, 5);
    expect(impactToScale(-5)).toBeCloseTo(LAYOUT.MIN_SCALE, 5);
    expect(impactToScale(99)).toBeCloseTo(LAYOUT.MAX_SCALE, 5);
  });
});

describe("visualMapping - freshness", () => {
  it("emissive is the clamped freshness value", () => {
    expect(freshnessToEmissive(0.5)).toBeCloseTo(0.5, 5);
    expect(freshnessToEmissive(undefined)).toBe(0);
    expect(freshnessToEmissive(2)).toBe(1);
    expect(freshnessToEmissive(-1)).toBe(0);
  });

  it("tier buckets fresh/recent/older", () => {
    expect(freshnessToTier(0.9)).toBe("fresh");
    expect(freshnessToTier(0.5)).toBe("recent");
    expect(freshnessToTier(0.1)).toBe("older");
    expect(freshnessToTier(undefined)).toBe("older");
  });
});

describe("visualMapping - category color exact hex", () => {
  it("returns the exact design-system hex per category", () => {
    expect(categoryToColorHex("domestic")).toBe("#22c55e");
    expect(categoryToColorHex("international")).toBe("#3b82f6");
    expect(categoryToColorHex("economic")).toBe("#f59e0b");
    expect(categoryToColorHex("political")).toBe("#ef4444");
  });

  it("writes the correct 0..1 rgb triplet into a buffer offset", () => {
    const buf = new Float32Array(6);
    writeCategoryColor("domestic", buf, 3);
    expect(buf[3]).toBeCloseTo(0x22 / 255, 5);
    expect(buf[4]).toBeCloseTo(0xc5 / 255, 5);
    expect(buf[5]).toBeCloseTo(0x5e / 255, 5);
    // Untouched region stays zero.
    expect(buf[0]).toBe(0);
  });

  it("hexToRgb01 parses correctly", () => {
    expect(hexToRgb01("#ffffff")).toEqual([1, 1, 1]);
    expect(hexToRgb01("#000000")).toEqual([0, 0, 0]);
  });
});

describe("visualMapping - sentiment derivation (>=7 / <=3 rule)", () => {
  it("matches the backend/REST rule exactly", () => {
    expect(deriveSentiment(node({ economicImpactScore: 7 }))).toBe("positive");
    expect(deriveSentiment(node({ economicImpactScore: 10 }))).toBe("positive");
    expect(deriveSentiment(node({ economicImpactScore: 3 }))).toBe("negative");
    expect(deriveSentiment(node({ economicImpactScore: 1 }))).toBe("negative");
    expect(deriveSentiment(node({ economicImpactScore: 4 }))).toBe("neutral");
    expect(deriveSentiment(node({ economicImpactScore: 6 }))).toBe("neutral");
    // Default (no score, no val) => 5 => neutral.
    expect(deriveSentiment(node({}))).toBe("neutral");
    // Falls back to val.
    expect(deriveSentiment(node({ val: 8 }))).toBe("positive");
  });

  it("maps sentiment to a tint hex", () => {
    expect(sentimentToTintHex("positive")).toBe("#22c55e");
    expect(sentimentToTintHex("negative")).toBe("#ef4444");
    expect(sentimentToTintHex("neutral")).toBe("#f59e0b");
  });
});

describe("visualMapping - age -> Z ordering (older = further)", () => {
  it("older articles map to a more-negative (further) Z", () => {
    const fresh = ageToZDepth(0);
    const oneDay = ageToZDepth(24 * 60 * 60 * 1000);
    const oneWeek = ageToZDepth(7 * 24 * 60 * 60 * 1000);
    expect(fresh).toBeCloseTo(0, 5);
    expect(oneDay).toBeLessThan(fresh);
    expect(oneWeek).toBeLessThan(oneDay);
  });

  it("clamps ancient ages to the far plane", () => {
    const ancient = ageToZDepth(LAYOUT.MAX_AGE_MS * 10);
    expect(ancient).toBeCloseTo(-LAYOUT.Z_DEPTH_RANGE, 5);
  });

  it("freshnessToZDepth: fresher sits nearer 0", () => {
    expect(freshnessToZDepth(1)).toBeCloseTo(0, 5);
    expect(freshnessToZDepth(0)).toBeCloseTo(-LAYOUT.Z_DEPTH_RANGE, 5);
    expect(freshnessToZDepth(0.5)).toBeLessThan(freshnessToZDepth(1));
  });
});
