// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { h, render } from "vue";
import { markdownNodes } from "../../../presentation/composables/coforge/markdown-nodes";
import { markdownHtml } from "../../../features/coforge/domain/markdown-html";
describe("safe authored Markdown", () => {
  it("uses escaped, script-free Markdown for static public exports too", () => {
    const output = markdownHtml(
      "**Bold**\n\n<script>alert(1)</script>\n\n![tracker](https://example.test/image) [x](javascript:alert(1))",
    );
    expect(output).toContain("<strong>Bold</strong>");
    expect(output).toContain("&lt;script&gt;");
    expect(output).not.toContain("<script>");
    expect(output).not.toContain("<img");
    expect(output).not.toContain("href=");
  });
  it("renders formatting, lists, tables and code without HTML, embeds or media requests", () => {
    const root = document.createElement("div");
    const text =
      "# Request\n\n**Bold** and *emphasis* with `code`.\n\n- One\n- Two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```ts\n<script>raw</script>\n```\n\n<script>alert(1)</script>\n\n![[Private vault note]]\n\n![Image](https://example.test/tracker.png)\n\n[Unsafe](javascript:alert(1)) [Safe](https://example.test/feature)";
    render(h("div", markdownNodes(text)), root);
    expect(root.querySelector("h1")?.textContent).toBe("Request");
    expect(root.querySelector("strong")?.textContent).toBe("Bold");
    expect(root.querySelectorAll("li")).toHaveLength(2);
    expect(root.querySelector("table")).not.toBeNull();
    expect(root.querySelector("pre code")?.textContent).toContain(
      "<script>raw</script>",
    );
    expect(root.querySelector("script,img,iframe,object,embed")).toBeNull();
    expect(root.querySelectorAll("a")).toHaveLength(1);
    expect(root.querySelector("a")?.getAttribute("rel")).toContain(
      "noreferrer",
    );
    expect(root.textContent).toContain("Private vault note");
    render(null, root);
  });
  it("keeps compact card previews non-interactive and bounds pathological input", () => {
    const root = document.createElement("div");
    render(
      h(
        "span",
        markdownNodes("**Bold** [link](https://example.test)\n\n- item", {
          compact: true,
          links: false,
        }),
      ),
      root,
    );
    expect(root.querySelector("strong")).not.toBeNull();
    expect(root.querySelector("a,input,button,table,h1")).toBeNull();
    expect(() => markdownNodes("> ".repeat(10000) + "text")).not.toThrow();
    render(null, root);
  });
});
