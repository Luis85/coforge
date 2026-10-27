import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { assemble } from "../scripts/clickdummy/build-single-file.mjs";

test("trusted JS survives HTML-comment/script tokens with exact CSP hashes and no eval or external script", () => {
  const javascript =
    'globalThis.result = ["<!--", "</script>", "<script>", "☃", /<!--/.test("<!--")];';
  const html = assemble({
    javascript,
    css: ".prototype-root { color: black; }",
    title: "Inline safety",
    projectBytes: Buffer.from(
      JSON.stringify({
        kind: "obsidian-companion-project",
        executable: false,
        project: { id: "coforge" },
      }),
    ),
  });
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  const bootstrap = scripts.find(
    (script) => !script[1].includes("application/json"),
  )[2];
  assert.equal(bootstrap.includes("<!--"), false);
  assert.equal(/<\/script/i.test(bootstrap), false);
  assert.equal(html.includes("'unsafe-eval'"), false);
  assert.equal(html.includes("script-src 'unsafe-inline'"), false);
  assert.equal(/<script[^>]*\bsrc=/.test(html), false);
  for (const code of [bootstrap, javascript])
    assert.ok(
      html.includes(
        `sha256-${createHash("sha256").update(code).digest("base64")}`,
      ),
    );
  const context = vm.createContext({ TextDecoder, atob });
  context.document = {
    createElement: () => ({ textContent: "" }),
    body: {
      appendChild: (script) => {
        new vm.Script(script.textContent).runInContext(context);
      },
    },
  };
  new vm.Script(bootstrap).runInContext(context);
  assert.deepEqual(Array.from(context.result), [
    "<!--",
    "</script>",
    "<script>",
    "☃",
    true,
  ]);
});
