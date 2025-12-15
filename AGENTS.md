# Repository Guidelines

## Project Structure & Module Organization
 PlotCouncil is a Vite + React 19 single-page app. Entry files `index.tsx` and `App.tsx` mount the UI, while feature components live in `components/` (`AnalysisView` orchestrates the agent timeline, `PyodidePlot` now proxies Matplotlib renders to the backend service, `ImageUploader` stores the history). Domain contracts, enums, and prompt fragments stay in `types.ts` and `services/`. The FastAPI renderer sits under `server/` and exposes `/render`; point `VITE_RENDER_API_URL` at it. `services/prompts.ts` defines the six-agent loop (Student → Dr.Style → Dr.Layout → Dr.Data → Chair QA → Chair Strategy) plus optional extra passes. Static assets ship from `public/` and the Vite build artifacts land in `dist/`.

## Build, Test, and Development Commands
- `npm install` — install Vite, React, Pyodide helpers, and `@google/genai`.
- `npm run dev` — start Vite on http://localhost:3000 with hot reload; append `-- --host 0.0.0.0` for LAN demos.
- `uvicorn server.main:app --reload` — launch the FastAPI renderer locally (requires `pip install -r server/requirements.txt`).
- `npm run build` — run type checks and emit the optimized bundle into `dist/`.
- `npm run preview` — serve the production bundle to verify Pyodide and screenshot capture before deploying.

## Coding Style & Naming Conventions
Write TypeScript with ES modules, two-space indentation, and PascalCase components. Co-locate hooks/state near their usage, prefer functional updates, and avoid ambient globals. Keep UI text and prompts centralized in `services/` to support future localization. When styling, reuse Tailwind utility classes defined in `App.tsx` before inventing new CSS.

## Testing Guidelines
Automated tests are not yet wired up; adopt `vitest` + `@testing-library/react` when adding coverage and name files `*.test.ts(x)`. Critical flows to exercise manually: multi-agent status transitions, Pyodide execution (`PyodidePlot`) including blank-plot guards, and screenshot history persistence (`plotHistory`). Record acceptance clips that show the histogram/CDF example rendering and teachers receiving six reviews.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat: add loop limit control`, `fix: guard blank renders`) and keep diffs focused. Every PR should summarize behavior changes, list manual checks (`npm run build`, scenario walkthrough), link the AI Studio app ID, and attach before/after screenshots or GIFs from the Plot History drawer. Reference issue IDs in the title when applicable.

## Security & Configuration Tips
Store the Gemini key in `.env.local` as `GEMINI_API_KEY=...`; Vite injects it at build-time, so never commit the file. Avoid logging raw base64 screenshots or API responses in production. When shipping analytics or extra services, funnel errors through `services/geminiService.ts` so the student agent receives actionable feedback before the Chairs loop begins, and keep the new FastAPI renderer sandboxed (Docker/Firejail) so arbitrary Matplotlib code cannot reach the host OS.
