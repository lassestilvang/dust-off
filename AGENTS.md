# AGENTS.md

## Repository Purpose
DustOff is a single-page React + TypeScript app (built with Vite, run with Bun) that helps migrate legacy code/repositories to Next.js + TypeScript using Google Gemini models.

It supports two UI workflows:
- `Snippet mode`: analyze/convert a pasted code snippet.
- `Repo mode`: fetch a GitHub repo tree/files, analyze architecture, propose a Next.js scaffold, generate files, and export a zip.

## High-Level Project Facts
- Project type: frontend SPA.
- Runtime/build tools: Bun + Vite.
- Languages: TypeScript/TSX.
- UI: React 19, Tailwind classes via CDN config in `index.html` (not Tailwind npm packages).
- Testing: Vitest + Testing Library + jsdom.
- Lint/format: ESLint flat config + Prettier.
- CI: GitHub Actions at `.github/workflows/ci.yml`.
- Repo size: small/medium (single package, no monorepo).

## Verified Environment
Validated on:
- Bun `1.3.9`
- Node `v25.6.1`
- npm `11.10.0` (not used for normal workflows)

CI installs Bun `latest` on Ubuntu and runs Bun scripts.

## Fast Start (Known-Good Sequence)
Always use Bun commands in this repo.

1. Install deps first (required):
```bash
bun install
```
2. Lint:
```bash
bun run lint
```
3. Test:
```bash
bun run test
```
4. Build:
```bash
bun run build
```
5. Run dev server:
```bash
bun run dev
# serves on http://localhost:3000
```
6. Preview production build:
```bash
bun run preview
# serves on http://localhost:4173 (or next available port)
```

## Command Validation Results (What Works / Fails)
All commands below were run and verified.

### Bootstrap
- `bun install`: works (about 0.4s-1s warm install).
- Must be run before `lint`, `test`, or `build` on a clean clone.

### If you skip install on a clean clone
- `bun run build` fails immediately: `vite: command not found` (exit 127).
- `bun run test` fails immediately: `vitest: command not found` (exit 127).
- `bun run lint` fails: cannot find `@eslint/js` from `eslint.config.js` (exit 2).

### Lint
- `bun run lint` works after install (~3s).

### Test
- `bun run test` works after install (~1-2s wall time).
- Expected behavior: passing suite still prints `console.error` in `services/geminiService.test.ts` because tests intentionally exercise error paths.

### Build
- `bun run build` works after install (~2s).

### Dev/Preview
- `bun run dev` works; long-running process by design.
- `bun run preview` works; long-running process by design.
- If port is occupied, Vite auto-selects next port.

### Formatting
- `bun run format:check` currently fails on baseline repo (exit 1) due formatting in:
  - `.github/workflows/ci.yml`
  - `package.json`
  - `vercel.json`
- This is not in CI, so do not assume `format:check` is a required gate unless you also run `bun run format`.

### Reordered command checks
- `build -> test -> lint` also passes after install.
- CI order (`lint -> test -> build`) passes locally.

### Timeouts / long-running commands
- No build/test/lint timeout observed.
- `dev` and `preview` are servers and do not exit on their own; stop with `Ctrl+C`.

## Required vs Optional Environment Setup
- `.env.example` defines `GEMINI_API_KEY`.
- Build/lint/test do **not** require a real key.
- Real AI features require a server-side `GEMINI_API_KEY` (local dev can use `.env.local`).
- Gemini requests flow through `/api/gemini` (Vercel function + Vite dev middleware), so the key is not injected into client bundles.

## Architecture and File Map

### Entrypoints
- `index.tsx`: mounts `<App />`.
- `App.tsx`: top-level mode switch (`repo` vs `snippet`) and page shell.

### Core domains
- `components/RepoMigration.tsx`: main orchestration UI/state for repository flow.
- `components/SnippetMigration.tsx`: snippet conversion flow.
- `services/geminiService.ts`: Gemini API wrappers, retries, generation/analyze/verify calls.
- `api/gemini.ts`: Vercel serverless endpoint for Gemini proxying.
- `server/geminiProxy.ts`: shared server-only Gemini proxy logic (used by API route + Vite dev middleware).
- `services/githubService.ts`: GitHub URL parsing, repo tree/file content fetching.
- `constants.ts`: all model prompt templates and default source snippet.
- `types.ts`: shared domain types and enums.

### Testing/layout config
- `vite.config.ts`: Vite + React plugin + Vitest config + env injection.
- `eslint.config.js`: flat ESLint config, TS rules, Prettier plugin.
- `test/setup.ts`: Testing Library setup.
- `.github/workflows/ci.yml`: authoritative CI checks.

### Non-obvious dependencies
- Tailwind is configured via CDN script in `index.html`; there is no `tailwind.config.js` or Tailwind npm toolchain.
- Prism theme and Google Fonts are also loaded in `index.html`.

## CI / Pre-PR Validation
Replicate CI exactly before opening a PR:
```bash
bun install
bun run lint
bun run test
bun run build
```
CI file: `.github/workflows/ci.yml`.

Optional additional confidence checks:
```bash
bun run dev
bun run preview
```

## Observed Change Validation
A temporary code edit was validated in a clean clone (`App.tsx` text change), then `lint + test + build` all passed. No unexpected build issues were triggered by normal TSX edits.

## Root File Inventory (tracked)
`.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc`, `App.tsx`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `GEMINI_INTEGRATION.md`, `LICENSE`, `README.md`, `SECURITY.md`, `bun.lock`, `constants.test.ts`, `constants.ts`, `eslint.config.js`, `index.html`, `index.tsx`, `metadata.json`, `package.json`, `tsconfig.json`, `types.ts`, `vercel.json`, `vite.config.ts`.

## Important Subdirectories
- `components/`: UI components and component tests.
- `services/`: integration/service logic and service tests.
- `test/`: shared test setup.
- `.github/workflows/`: CI pipeline.
- `public/`: static assets.

### `components/` file list
`AgentLogs.tsx`, `AnalysisPanel.tsx`, `CodeEditor.tsx`, `CodeEditor.test.tsx`, `FileExplorer.tsx`, `FileExplorer.test.tsx`, `Header.tsx`, `Icons.tsx`, `InfoModal.tsx`, `MigrationReportModal.tsx`, `RepoMigration.tsx`, `SnippetMigration.tsx`, `StepIndicator.tsx`, `StepIndicator.test.tsx`.

### `services/` file list
`geminiService.ts`, `geminiService.test.ts`, `githubService.ts`, `githubService.test.ts`.

## README Highlights
- Product goal: migrate legacy repos/snippets to modern Next.js+TS projects.
- Prereqs: Bun and Gemini API key.
- Start command: `bun dev`.
- Test command: `bun run test`.

## Key Entrypoint Snippet
```tsx
// index.tsx
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

## Agent Working Rule
Trust this file first. Only search the repository when:
- the task needs details not covered here, or
- these instructions are outdated/incorrect for the current branch.
