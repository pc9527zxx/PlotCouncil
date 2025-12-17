import React from 'react';
import { ImageUploader } from './ImageUploader';
import { PlotImage, AnalysisStatus } from '../types';
import { Play, Command, Zap, BrainCircuit, Wrench, Image as ImageIcon } from 'lucide-react';

type RunMode = 'simple' | 'complex' | 'manual';
type ReviewPreset = 'lite' | 'full';

interface SourcePanelProps {
  selectedImage: PlotImage | null;
  onImageSelected: (image: PlotImage | null) => void;
  status: AnalysisStatus;
  onStartAnalysis: () => void;
  isBusy: boolean;
  runMode: RunMode;
  setRunMode: (mode: RunMode) => void;
  reviewPreset: ReviewPreset;
  setReviewPreset: (preset: ReviewPreset) => void;
  maxAutoLoops: number;
  setMaxAutoLoops: (loops: number) => void;
  onShowToast?: (message: string, type: 'info' | 'success' | 'error') => void;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  selectedImage,
  onImageSelected,
  status,
  onStartAnalysis,
  isBusy,
  runMode,
  setRunMode,
  reviewPreset,
  setReviewPreset,
  maxAutoLoops,
  setMaxAutoLoops,
  onShowToast
}) => {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800">
      
      {/* 1. Header with Controls (FIX 3: Relocated Controls) */}
      <div className="flex-shrink-0 h-12 flex items-center justify-between px-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
         <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
           <ImageIcon className="w-3.5 h-3.5" />
           Input
         </span>

         {/* Compact Toolbar */}
         <div className="flex items-center gap-2">
            {/* Segmented Mode Selector */}
            <div className="flex p-0.5 bg-slate-200 dark:bg-zinc-800 rounded-md">
                <button 
                  onClick={() => setRunMode('simple')}
                  className={`px-2 py-1 rounded-[4px] text-[10px] font-bold transition-all ${runMode === 'simple' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  title="Simple Mode"
                >
                   <Zap className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setRunMode('complex')}
                  className={`px-2 py-1 rounded-[4px] text-[10px] font-bold transition-all ${runMode === 'complex' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  title="Complex Mode"
                >
                   <BrainCircuit className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setRunMode('manual')}
                  className={`px-2 py-1 rounded-[4px] text-[10px] font-bold transition-all ${runMode === 'manual' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  title="Manual Mode"
                >
                   <Wrench className="w-3 h-3" />
                </button>
            </div>

            {/* Review Preset Toggle */}
            <div className="flex p-0.5 bg-slate-200/70 dark:bg-zinc-800 rounded-md">
                <button
                  onClick={() => setReviewPreset('lite')}
                  className={`px-2 py-1 rounded-[4px] text-[10px] font-bold transition-all ${reviewPreset === 'lite' ? 'bg-white dark:bg-zinc-700 text-amber-700 dark:text-amber-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  title="Chair-only QA"
                >
                  Lite
                </button>
                <button
                  onClick={() => setReviewPreset('full')}
                  className={`px-2 py-1 rounded-[4px] text-[10px] font-bold transition-all ${reviewPreset === 'full' ? 'bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  title="Teacher review + Chair QA"
                >
                  Full
                </button>
            </div>

            {/* Run Button (FIX 3: Compact Style) */}
            <button
               onClick={onStartAnalysis}
               disabled={!selectedImage || isBusy}
               className={`
                 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm transition-all border
                 ${!selectedImage || isBusy 
                   ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed border-slate-200 dark:border-zinc-700' 
                   : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-[0.98]'}
               `}
               title="Generate Plot"
            >
               {isBusy ? (
                 <>
                   <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                   <span>Running</span>
                 </>
               ) : (
                 <>
                   <Play className="w-3 h-3 fill-current" />
                   <span>Run</span>
                 </>
               )}
            </button>
         </div>
      </div>

      {/* 2. Flexible Image Content (FIX 2: Optimized Space) */}
      <div className="flex-1 min-h-0 p-3 overflow-y-auto custom-scrollbar relative bg-slate-50/30 dark:bg-zinc-950/30">
         <div className="min-h-full flex flex-col">
            <div className="flex-1 min-h-0 relative">
               <ImageUploader selectedImage={selectedImage} onImageSelected={onImageSelected} onShowToast={onShowToast} />
            </div>
            
            {/* Manual Mode Slider (Conditional) */}
            {runMode === 'manual' && (
               <div className="mt-3 flex items-center gap-2 px-2 py-1.5 bg-slate-100 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700 animate-in slide-in-from-bottom-2 duration-200 flex-shrink-0">
                  <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase tracking-wider">Refine Loops</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="5" 
                    step="1" 
                    value={maxAutoLoops}
                    onChange={(e) => setMaxAutoLoops(parseInt(e.target.value))}
                    className="flex-1 h-1 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 w-4 text-center">{maxAutoLoops}</span>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};