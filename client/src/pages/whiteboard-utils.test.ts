import { describe, expect, it } from "vitest";
import { resolveActivePageIndex } from "./whiteboard-utils";

describe("whiteboard page initialization", () => {
  it("keeps the active page when it exists", () => {
    expect(resolveActivePageIndex([{ pageIndex: 0 }, { pageIndex: 2 }], 2)).toBe(2);
  });

  it("selects the first persisted page when the default page is absent", () => {
    expect(resolveActivePageIndex([{ pageIndex: 4 }, { pageIndex: 1 }], 0)).toBe(1);
  });

  it("does not change the default when no pages have loaded yet", () => {
    expect(resolveActivePageIndex([], 0)).toBe(0);
  });
});
