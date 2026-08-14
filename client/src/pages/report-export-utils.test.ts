import { describe, expect, it } from "vitest";
import { resolvePrintWindow } from "./report-export-utils";

describe("resolvePrintWindow", () => {
  it("returns null when the browser blocks the print popup", () => {
    expect(resolvePrintWindow(() => null)).toBeNull();
  });

  it("returns an open print window before asynchronous report work", () => {
    const printWindow = { closed: false };
    expect(resolvePrintWindow(() => printWindow)).toBe(printWindow);
  });

  it("rejects a window already closed by the browser", () => {
    expect(resolvePrintWindow(() => ({ closed: true }))).toBeNull();
  });
});
