# DustOff — Comprehensive Improvement Roadmap

## ✅ Progress (2026-02-16)

- Completed: #1 Extract RepoMigration into hooks/services
- Completed: #2 Build-time Tailwind migration
- Completed: #3 Removed `index.html` importmap/CDN module mapping
- Completed: #4 Migrated large `RepoState` updates to typed `useReducer`
- Completed: #6 Cancellation support
- Completed: #7 Streaming/progressive file generation
- Completed: #12 Multi-pass verification for repo mode
- Completed: #13 Topological file generation ordering
- Completed: #14 Semantic cross-file context injection
- Completed: #15 Prompt engineering improvements
- Completed: #16 GitHub API rate limiting awareness
- Completed: #17 Upfront Gemini API key validation
- Completed: #18 Broadened Gemini retry logic for transient failures
- Completed: #19 Large repo scope controls with truncation warnings
- Completed: #20 Persistent state / session recovery
- Completed: #21 Repo generation progress indicator
- Completed: #22 Keyboard shortcuts
- Completed: #23 Mobile responsiveness improvements
- Completed: #24 Copy-to-clipboard for generated code
- Completed: #25 Dark/light theme toggle
- Completed: #26 Expanded test coverage for core migration UI flows
- Completed: #28 Bundle analysis & optimization
- Completed: #29 Add PWA support
- Completed: #30 Environment variable validation at startup
- Completed: #9 Editable generated code
- Completed: #10 Per-file regeneration
- Completed: #32 Migration playbook / plan review step
- Completed: #33 Interactive migration (human-in-the-loop clarifications)
- Completed: #34 Cost estimator
- Completed: #35 Migration history dashboard

## 🏗️ ARCHITECTURE & CODE QUALITY

- [x] **1. Extract state management from monolithic components**
      `RepoMigration.tsx` (1060 lines!) is a god component — state, business logic, UI, and orchestration are all tangled together. Extract into:
  - A `useRepoMigration()` custom hook for all state/orchestration logic
  - A `useMigrationLogs()` hook for logging
  - Separate the 3 phases (analyze, scaffold, generate) into composable async functions in a `services/migrationOrchestrator.ts`

- [x] **2. Replace CDN Tailwind with proper build-time Tailwind**
      Using `cdn.tailwindcss.com` means no tree-shaking, no PostCSS plugins, no `@apply`, no custom plugin support, and a large runtime download on every page load. Install Tailwind as a dev dependency for proper production builds.

- [x] **3. Remove the importmap in `index.html`**
      You have a full Vite build pipeline but also an importmap pointing to `esm.sh` CDN URLs. This is confusing — Vite already bundles these deps. The importmap is likely dead code from an earlier esm.sh-only iteration.

- [x] **4. Single `useState` managing a huge object → useReducer or Zustand**
      `RepoState` has 14+ fields mutated via `setState(prev => ({...prev, ...}))` scattered everywhere. A `useReducer` with typed actions would be clearer and less error-prone.

---

## 🚀 FEATURES — HIGH IMPACT

- [ ] **5. GitHub Authentication / PAT support**
      Currently only public repos work, and you hit rate limits fast (60 req/hr unauthenticated). Add a PAT input field or GitHub OAuth flow to:
  - Support private repos
  - Get 5,000 req/hr instead of 60
  - Access branch selection

- [x] **6. Cancellation support**
      There's no way to cancel a long-running migration. Add an `AbortController` pattern to cancel in-flight Gemini API calls and GitHub fetches.

- [x] **7. Streaming / progressive file generation**
      Currently files are generated sequentially with no streaming. Use Gemini's streaming API (`generateContentStream`) to show code appearing character-by-character in the editor — much better UX for long waits.

- [ ] **8. Side-by-side diff view (source → target)**
      The biggest missing UX feature. Users want to see the _old file_ next to the _new file_ for each component, with a diff highlight showing what changed. This is the killer feature for a migration tool.

- [x] **9. Editable generated code**
      Generated files are read-only. Let users edit generated code before downloading, so they can fix issues or tweak the output without downloading first.

- [x] **10. Per-file regeneration**
      If a single file is bad, users should be able to right-click → "Regenerate this file" with optional user instructions (e.g., "use server component instead"), rather than re-running the entire migration.

- [ ] **11. Migration target beyond Next.js**
      Currently hardcoded to Next.js 16.1 + TypeScript. Consider supporting other targets like:
  - Remix, SvelteKit, Nuxt 4, Astro
  - Even non-framework targets (vanilla TypeScript modernization, Python 2→3)

---

## 🧠 AI QUALITY

- [x] **12. Multi-pass verification for repo mode**
      Snippet mode has analyze→convert→verify. Repo mode skips verification entirely — it generates files but never verifies them. Add a post-generation verification pass that checks cross-file consistency (imports exist, types match).

- [x] **13. Smarter file generation ordering via dependency graph**
      Files are generated in alphabetical order, but foundational files (types, utils, configs) should be generated FIRST so their content can be injected as `relatedFilesContext` for dependent files. Use the dependency graph topologically.

- [x] **14. Cross-file context injection is weak**
      `getRelatedFiles()` does a simple name match (`Header.tsx` source → `Header.tsx` target). This misses cases where source files are reorganized. Use semantic matching from the analysis, not just filename matching.

- [x] **15. Prompt engineering improvements**
  - Add few-shot examples in prompts for better JSON reliability
  - The `GENERATION_PROMPT_TEMPLATE` should specify the exact Next.js App Router conventions (when to use `'use client'`, server components, route handlers)
  - Add a `SYSTEM` message role for the model identity/instructions

---

## 🛡️ RELIABILITY & ERROR HANDLING

- [x] **16. Rate limiting awareness for GitHub API**
      No rate-limit tracking. If you're fetching 50 files sequentially, you'll burn through the 60 req/hr limit in one run. Add:
  - Rate limit header parsing (`X-RateLimit-Remaining`)
  - Queuing with delays
  - User-visible rate limit indicator

- [x] **17. Gemini API key validation**
      No key validation before starting a migration. Users can start a long repo analysis only to fail at the first API call. Add an upfront key check.

- [x] **18. Retry logic only handles 503**
      `withRetry` only retries on 503/overload. Gemini also throws 429 (quota), 500 (internal), and network errors. Broaden the retry surface.

- [x] **19. Graceful handling of large repos**
      Repos with >500 files are truncated silently (`limitedPaths = allPaths.slice(0, 500)`). Show a warning and let users pick which directories to include/exclude.

---

## 🎨 UX / POLISH

- [x] **20. Persistent state / session recovery**
      All state is in-memory. Refreshing the page loses everything. Add `localStorage` persistence for the last migration state, URL, and generated files.

- [x] **21. Progress indicator for repo migration**
      During file generation, show "Generating file 7 of 23" with a progress bar, not just log messages. The current UX during a 5-minute migration is just a spinning loader.

- [x] **22. Keyboard shortcuts**
  - `Ctrl+Enter` to start migration
  - `Escape` to close modals
  - Arrow keys to navigate file tree

- [x] **23. Mobile responsiveness gaps**
      The file explorer and three-column layout collapse poorly on tablets. The example repo buttons overflow on mobile.

- [x] **24. Copy-to-clipboard for generated code**
      No way to quickly copy a single file's generated code without downloading the whole zip.

- [x] **25. Dark/light theme toggle**
      Currently hardcoded dark mode only. Some users prefer light mode, especially for code review.

---

## 🧪 TESTING

- [x] **26. Test coverage expansion for core UI flows**
      Added coverage for:
  - `RepoMigration` integration flow tests
  - `SnippetMigration` workflow tests
  - `MigrationConfig` interaction tests
  - `MigrationReportModal` rendering/action tests

- [ ] **27. No integration/E2E testing**
      Add Playwright or Cypress for full flow testing with mocked API responses.

---

## 📦 BUILD & INFRA

- [x] **28. Bundle analysis & optimization**
      No bundle analysis configured. `@google/genai`, `jszip`, `lucide-react`, and `prismjs` with all language grammars are likely making the bundle large. Add `rollup-plugin-visualizer` and lazy-load non-critical deps.

- [x] **29. Add PWA support**
      A migration tool benefits from offline capability (reviewing previously generated code). Add a service worker and manifest.

- [x] **30. Environment variable validation at startup**
      `getApiKey()` silently returns `''` if no key is set. Show a clear onboarding banner: "Add your Gemini API key to get started."

---

## 🔮 AMBITIOUS / DIFFERENTIATING FEATURES

- [ ] **31. GitHub App integration — "Open PR with migrated code"**
      Instead of just downloading a zip, let users create a new repo or open a PR directly from DustOff with the generated code.

- [x] **32. Migration playbook / plan review step**
      Before generating code, show users a detailed migration plan: "We'll convert 12 Vue components into React Server Components, replace Vuex with Zustand, and add 8 test files." Let them approve/modify before execution.

- [x] **33. Interactive migration — human-in-the-loop**
      For complex files, let the AI ask the user questions: "This file uses a custom auth system. Should I migrate to NextAuth.js or keep the custom implementation?"

- [x] **34. Cost estimator**
      Show estimated Gemini API token usage/cost before starting a migration, based on repo size.

- [x] **35. Migration history dashboard**
      Track past migrations, let users compare different runs, and show improvement trends.

---

## 📊 Priority Matrix

| Priority | Feature                                 | Impact | Effort  |
| -------- | --------------------------------------- | ------ | ------- |
| 🔴 P0    | [x] #1 Extract RepoMigration into hooks | High   | Medium  |
| 🔴 P0    | [ ] #5 GitHub PAT / auth support        | High   | Low     |
| 🔴 P0    | [x] #6 Cancel migration                 | High   | Low     |
| 🔴 P0    | [x] #2 Proper Tailwind build            | Medium | Low     |
| 🟡 P1    | [ ] #8 Side-by-side diff view           | High   | Medium  |
| 🟡 P1    | [x] #7 Streaming generation             | High   | Medium  |
| 🟡 P1    | [x] #10 Per-file regeneration           | High   | Low     |
| 🟡 P1    | [x] #21 Progress bar                    | Medium | Low     |
| 🟡 P1    | [x] #12 Post-gen verification           | High   | Medium  |
| 🟡 P1    | [x] #13 Topological gen ordering        | Medium | Low     |
| 🟢 P2    | [x] #9 Editable output                  | Medium | Low     |
| 🟢 P2    | [x] #24 Copy to clipboard               | Medium | Trivial |
| 🟢 P2    | [x] #20 Session persistence             | Medium | Low     |
| 🟢 P2    | [ ] #11 Multiple target frameworks      | High   | High    |
| 🟢 P2    | [x] #32 Migration plan review           | High   | Medium  |
| 🔵 P3    | [ ] #31 GitHub PR integration           | High   | High    |
| 🔵 P3    | [x] #33 Human-in-the-loop               | High   | High    |
| 🔵 P3    | [ ] #27 E2E tests                       | Medium | Medium  |
