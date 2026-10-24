/** Marks workflow files CoForge owns; any other file at the same path is never overwritten. */
export const WORKFLOW_MARKER = '# Managed by CoForge: deploys the public viewer board to GitHub Pages.';
export const WORKFLOW_PATH = '.github/workflows/coforge-pages.yml';

/** Repository-relative folder as a YAML-safe double-quoted string. */
const quoted = (value: string) => JSON.stringify(value);

/**
 * GitHub Actions workflow that publishes the board folder from `main` to GitHub Pages whenever it changes.
 * `folder` is the board folder relative to the repository root, with forward slashes.
 */
export function pagesWorkflow(folder: string, branch = 'main'): string {
  const path = folder.replace(/\\/g, '/').replace(/^\.?\/+|\/+$/g, '') || '.';
  return `${WORKFLOW_MARKER}
# Enable it once in the repository: Settings > Pages > Build and deployment > Source: GitHub Actions.
name: CoForge viewer board

on:
  push:
    branches: [${quoted(branch)}]
    paths:
      - ${quoted(path === '.' ? '**' : `${path}/**`)}
      - ${quoted(WORKFLOW_PATH)}
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: coforge-pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: ${quoted(path)}
      - id: deployment
        uses: actions/deploy-pages@v4
`;
}
