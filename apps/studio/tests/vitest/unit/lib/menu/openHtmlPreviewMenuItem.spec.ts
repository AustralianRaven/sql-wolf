import { describe, it, expect, vi } from "vitest";
import { openHtmlPreviewMenuItem } from "@/lib/menu/tableMenu";

function createMockCell(value: any, title = "HtmlContent") {
  return {
    getValue: vi.fn(() => value),
    getField: vi.fn(() => "htmlcontent"),
    getColumn: vi.fn(() => ({ getDefinition: () => ({ title }) })),
  } as any;
}

describe("openHtmlPreviewMenuItem", () => {
  it.each([
    ["null", null],
    ["a number", 42],
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["binary data", new Uint8Array([60, 112, 62])],
  ])("Given a cell holding %s, the item is disabled", (_name, value) => {
    const item = openHtmlPreviewMenuItem(createMockCell(value), vi.fn());
    expect(item.disabled, `Then "Open as HTML" is disabled for ${_name}`).toBe(true);
  });

  it("Given a cell holding HTML, when the item is clicked, then an html-preview tab opens with the raw HTML", () => {
    const open = vi.fn();
    const html = "<p>Hello <b>Kat</b></p>";
    const item = openHtmlPreviewMenuItem(createMockCell(html), open);
    expect(item.disabled, "Then the item is enabled").toBe(false);

    item.action();

    expect(open, "Then an html-preview tab is requested with the raw HTML").toHaveBeenCalledWith({
      tabType: "html-preview",
      title: "HTML: HtmlContent",
      unsavedQueryText: html,
      unsavedChanges: false,
    });
  });

  it("Given a column without a title, the tab title falls back to the field name", () => {
    const open = vi.fn();
    openHtmlPreviewMenuItem(createMockCell("<p/>", ""), open).action();
    expect(open.mock.calls[0][0].title, "Then the title uses the field name").toBe("HTML: htmlcontent");
  });
});
