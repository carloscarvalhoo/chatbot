import { describe, it, expect } from "vitest";
import { classifyProviderError, RETRYABLE_SAME_MODEL } from "@/server/ai/errors";

describe("classifyProviderError", () => {
  const cases = [
    [{ status: 429 }, "quota"],
    [{ message: "RESOURCE_EXHAUSTED: quota" }, "quota"],
    [{ status: 503 }, "overloaded"],
    [{ message: "model is overloaded" }, "overloaded"],
    [{ status: 500 }, "server"],
    [{ status: 404 }, "not_found"],
    [{ message: "model X is no longer available" }, "not_found"],
    [{ status: 401 }, "auth"],
    [{ name: "AbortError" }, "timeout"],
    [{ message: "request timed out" }, "timeout"],
    [{ message: "blocked by safety filter" }, "content_filter"],
    [{ message: "algo aleatório" }, "unknown"],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${expected}`, () => {
      expect(classifyProviderError(input)).toBe(expected);
    });
  }

  it("retry só em transitórios", () => {
    expect(RETRYABLE_SAME_MODEL.has("overloaded")).toBe(true);
    expect(RETRYABLE_SAME_MODEL.has("timeout")).toBe(true);
    expect(RETRYABLE_SAME_MODEL.has("quota")).toBe(false);
    expect(RETRYABLE_SAME_MODEL.has("not_found")).toBe(false);
  });
});
