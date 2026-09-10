import { describe, it, expect } from "vitest";
import { millisUntilPacificMidnight, estimateRetry } from "@/server/ai/quota";

describe("millisUntilPacificMidnight", () => {
  it("está entre 0 e 24h", () => {
    const ms = millisUntilPacificMidnight();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 3600 * 1000);
  });
});

describe("estimateRetry", () => {
  it("todos com cota → espera longa (horas)", () => {
    const { retryAfterMs, reason } = estimateRetry([{ kind: "quota" }, { kind: "quota" }]);
    expect(reason).toBe("quota");
    expect(retryAfterMs).toBeGreaterThan(10 * 60 * 1000);
  });

  it("cota parcial → 2 min", () => {
    const { retryAfterMs, reason } = estimateRetry([{ kind: "quota" }, { kind: "not_found" }]);
    expect(reason).toBe("quota");
    expect(retryAfterMs).toBe(2 * 60 * 1000);
  });

  it("sobrecarga → 1 min", () => {
    const { retryAfterMs, reason } = estimateRetry([{ kind: "overloaded" }]);
    expect(reason).toBe("overloaded");
    expect(retryAfterMs).toBe(60 * 1000);
  });
});
