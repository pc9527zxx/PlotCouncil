import React, { useMemo, useCallback } from 'react';
import { X, BookOpen, Sparkles, GitBranch, ShieldCheck, Repeat, ListChecks, Wand2, Compass, Layers, Timer, Workflow, Info } from 'lucide-react';

interface DocsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
}

type SectionDef = {
  id: string;
  title: string;
  icon: React.ReactNode;
  body: React.ReactNode;
};

const Section: React.FC<{ id: string; title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ id, title, icon, children }) => (
  <section id={id} className="space-y-2 scroll-mt-20">
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
      <span className="w-1.5 h-6 rounded-full bg-indigo-500" />
      {icon}
      <span>{title}</span>
    </h3>
    <div className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-200 space-y-2">
      {children}
    </div>
  </section>
);

export const DocsPanel: React.FC<DocsPanelProps> = ({ isOpen, onClose, darkMode }) => {
  const sections = useMemo<SectionDef[]>(() => [
    {
      id: 'overview',
      title: 'What PlotCouncil does',
      icon: <Sparkles className="w-3.5 h-3.5 text-indigo-500" />,
      body: (
        <p>
          Upload a plot screenshot, let the six-agent loop read it, generate Matplotlib code, auto-refine when risk stays high, and preview in a sandboxed Pyodide runtime. No local installs needed for the UI.
        </p>
      )
    },
    {
      id: 'flow',
      title: 'End-to-end flow',
      icon: <Workflow className="w-3.5 h-3.5 text-indigo-500" />,
      body: (
        <ol className="list-decimal pl-4 space-y-2">
          <li><strong>Input</strong>: drop a chart screenshot in the Input panel.</li>
          <li><strong>Mode</strong>: choose Simple (fast) or Complex (guarantees ≥1 refine when risky). Manual lets you set loop budget explicitly.</li>
          <li><strong>Generate</strong>: Gemini returns Matplotlib code; we extract Python block automatically.</li>
          <li><strong>Preview</strong>: code runs in Pyodide; rendered plot appears in Generated Output.</li>
          <li><strong>Review</strong>: five reviewers (Style, Layout, Data, Chair QA/Strategy) show structured findings + raw JSON toggle.</li>
          <li><strong>Iterate</strong>: auto-refine triggers when risk &gt; 0.6 and budget &gt; 0; you can also manually rerun.</li>
          <li><strong>History</strong>: Plot History stores prior renders and code snapshots per project.</li>
        </ol>
      )
    },
    {
      id: 'projects',
      title: 'Project management',
      icon: <Layers className="w-3.5 h-3.5 text-indigo-500" />,
      body: (
        <ul className="list-disc pl-4 space-y-2">
          <li>Create separate projects to isolate images, code, logs, and history.</li>
          <li>Inline rename via the pencil icon; timestamps stay untouched.</li>
          <li>Deleting switches to the next available project; otherwise a new project is created.</li>
        </ul>
      )
    },
    {
      id: 'auto-refine',
      title: 'Auto-refine logic (Complex/Manual)',
      icon: <Repeat className="w-3.5 h-3.5 text-indigo-500" />,
      body: (
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
              <Timer className="w-3.5 h-3.5 text-indigo-500" /> When it triggers
            </div>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li>Requires API key + autoRefine enabled + loopBudget &gt; 0.</li>
              <li>Runs after successful render callback or runtime error callback.</li>
              <li>Risk score &gt; 0.6 keeps looping until the budget ends.</li>
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
              <ListChecks className="w-3.5 h-3.5 text-indigo-500" /> What gets reset
            </div>
            <p className="text-[12px] mt-1">Each refine clears rendered image, logs, and errors so Pyodide re-runs with the new code.</p>
          </div>
        </div>
      )
    },
    {
      id: 'reviewers',
      title: 'Reviewer structure',
      icon: <Compass className="w-3.5 h-3.5 text-indigo-500" />,
      body: (
        <ul className="list-disc pl-4 space-y-2">
          <li><strong>Style/Layout/Data</strong>: palette, typography/alignment, data-label fidelity, distribution findings.</li>
          <li><strong>Chair QA</strong>: accept/reject, risk score, priority fixes, action items.</li>
          <li><strong>Chair Strategy</strong>: final decision, release note, acceptance tests.</li>
          <li>Use <code>Show raw JSON</code> to inspect exact model output.</li>
        </ul>
      )
    },
    {
      id: 'tips',
      title: 'Quick tips',
      icon: <Info className="w-3.5 h-3.5 text-indigo-500" />,
      body: (
        <ul className="list-disc pl-4 space-y-2">
          <li>Pick Complex for messy charts; Simple for speed.</li>
          <li>High Chair risk? Raise loop budget in Manual/Complex and rerun.</li>
          <li>Dark mode via sidebar sun/moon; settings under the gear icon.</li>
          <li>Keep Gemini API key in Settings; empty key runs simulation.</li>
        </ul>
      )
    },
    {
      id: 'release',
      title: 'Current build notes',
      icon: <GitBranch className="w-3.5 h-3.5 text-indigo-500" />,
      body: (
        <div className="space-y-1 text-[12px] text-slate-700 dark:text-slate-200">
          <div className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Inline rename preserves timestamps.</div>
          <div className="flex items-center gap-2"><Wand2 className="w-3.5 h-3.5 text-indigo-500" /> Unified reviewer UI with raw JSON toggle.</div>
          <div className="flex items-center gap-2"><GitBranch className="w-3.5 h-3.5 text-amber-500" /> Auto-refine clears stale renders to force reruns.</div>
        </div>
      )
    }
  ], []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-full bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            Product Guide
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Inline reference — no install needed
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-lg transition-colors"
              aria-label="Close docs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[220px,1fr] min-h-0">
          <aside className="hidden lg:flex flex-col border-r border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 p-4 space-y-3 sticky top-0 max-h-full">
            <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Contents</div>
            <div className="flex flex-col gap-2 text-[12px]">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className="flex items-center gap-2 text-left px-2 py-2 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-200"
                >
                  {s.icon}
                  <span>{s.title}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="p-4 sm:p-6 space-y-6 custom-scrollbar overflow-y-auto">
            <div className="p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Welcome to PlotCouncil
              </div>
              <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">
                Start from a screenshot, end with reproducible Matplotlib code and structured QA. Use the quick nav on the left to jump to what you need.
              </p>
            </div>

            {sections.map((s) => (
              <Section key={s.id} id={s.id} title={s.title} icon={s.icon}>
                {s.body}
              </Section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
