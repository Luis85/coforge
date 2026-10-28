import { expect, it } from "vitest";
import {
  normalizeVaultFolder,
  validateFolderLayout,
} from "../../../features/coforge/domain/vault-folder-policy";
it("normalizes vault-relative separators and segments while preserving valid custom names", () => {
  expect(normalizeVaultFolder(" Requests\\Game..notes//./Backlog/ ")).toBe(
    "Requests/Game..notes/Backlog",
  );
  expect(
    validateFolderLayout({
      ideasFolder: "Requests/Backlog",
      publicFolder: "Requests/Website",
    }),
  ).toEqual({
    ideasFolder: "Requests/Backlog",
    publicFolder: "Requests/Website",
  });
  expect(() =>
    validateFolderLayout({
      ideasFolder: "Publications",
      publicFolder: "Public",
    }),
  ).not.toThrow();
});
it.each([
  ["Requests", "requests/Site"],
  ["Requests/Backlog", "Requests"],
  ["CoForge/Public/Requests", "Website"],
  ["Requests/Backlog", "REQUESTS\\./Backlog/"],
  ["Requests", "CoForge/Projects"],
  ["Requests", ".custom-config/Exports"],
])(
  "rejects overlapping private/public boundaries before either can be written: %s / %s",
  (ideasFolder, publicFolder) => {
    expect(() =>
      validateFolderLayout({ ideasFolder, publicFolder }, [".custom-config"]),
    ).toThrow("private");
  },
);
it.each([
  "/outside",
  "../outside",
  "A/../outside",
  "A\\..\\outside",
  "C:\\private",
  "\\\\server\\share",
  "A/\u0000B",
])("rejects absolute or traversal folder paths: %s", (value) => {
  expect(() => normalizeVaultFolder(value)).toThrow();
});
