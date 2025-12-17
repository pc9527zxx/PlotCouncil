import React, { useRef, useState, useEffect } from 'react';
import { Upload, X, Maximize2, Minimize2, ArrowUpFromLine, Clipboard, Copy, RefreshCw } from 'lucide-react';
import { PlotImage } from '../types';

interface ImageUploaderProps {
  onImageSelected: (image: PlotImage | null) => void;
  selectedImage: PlotImage | null;
  onShowToast?: (message: string, type: 'info' | 'success' | 'error') => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, selectedImage, onShowToast }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'error'>('idle');

  const processFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      if (onShowToast) {
        onShowToast('Please upload an image file (PNG, JPG, WEBP).', 'error');
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64Content = result.split(',')[1];
      onImageSelected({
        base64: base64Content,
        previewUrl: result,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => { window.removeEventListener('paste', handlePaste); };
  }, [onImageSelected]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const copyImage = async () => {
    if (!selectedImage?.previewUrl) return;
    try {
      const res = await fetch(selectedImage.previewUrl);
      const blob = await res.blob();
      // Prefer ClipboardItem if available for image MIME
      if ((window as any).ClipboardItem) {
        const item = new (window as any).ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
      } else {
        // Fallback: copy data URL as text (less ideal but better than nothing)
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const txt = ev.target?.result as string;
          await navigator.clipboard.writeText(txt);
        };
        reader.readAsDataURL(blob);
      }
      setCopyState('ok');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch (err) {
      console.error('Copy image failed', err);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 1500);
    }
  };

  const tryPasteFromClipboard = async () => {
    if (!navigator.clipboard || !(navigator.clipboard as any).read) {
      return;
    }
    try {
      const items = await (navigator.clipboard as any).read();
      for (const item of items) {
        const type = item.types.find((t: string) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          const file = new File([blob], 'pasted-image', { type });
          processFile(file);
          return;
        }
      }
      return;
    } catch (err) {
      console.error('Paste image failed', err);
      return;
    }
  };

  if (selectedImage) {
    if (isZoomed) {
      return (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200 backdrop-blur-sm">
          <div className="relative w-full h-full flex items-center justify-center">
            <img src={selectedImage.previewUrl} alt="Zoomed" className="max-w-full max-h-full object-contain shadow-2xl rounded-sm" />
            <button onClick={() => setIsZoomed(false)} className="absolute top-0 right-0 m-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all border border-white/20 backdrop-blur-md group">
              <Minimize2 className="w-6 h-6 group-hover:scale-90 transition-transform" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute inset-0 w-full h-full group bg-slate-900/5 dark:bg-black rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800">
        <img src={selectedImage.previewUrl} alt="Target" className="w-full h-full object-contain p-2" />
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
           <button onClick={(e) => { e.stopPropagation(); setIsZoomed(true); }} className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-sm" title="Zoom">
             <Maximize2 className="w-3 h-3" />
           </button>
           <button onClick={(e) => { e.stopPropagation(); onImageSelected(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="bg-red-500/80 hover:bg-red-600/90 text-white p-1.5 rounded-md backdrop-blur-md border border-white/10 shadow-sm" title="Remove">
             <X className="w-3 h-3" />
           </button>
        </div>

        <div className="absolute bottom-2 right-2 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); copyImage(); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-white/90 dark:bg-zinc-900/80 text-slate-700 dark:text-slate-100 shadow border border-slate-200 dark:border-zinc-700 hover:border-indigo-300 hover:text-indigo-700"
            title="Copy image to clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
            {copyState === 'ok' ? 'Copied' : copyState === 'error' ? 'Retry' : 'Copy'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-white/90 dark:bg-zinc-900/80 text-slate-700 dark:text-slate-100 shadow border border-slate-200 dark:border-zinc-700 hover:border-indigo-300 hover:text-indigo-700"
            title="Replace image"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Replace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={handleDrop}
      className={`
        absolute inset-0 w-full h-full flex flex-col items-center justify-center 
        cursor-pointer transition-all duration-300 group rounded-xl border-2 border-dashed
        ${isDragging 
          ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-400' 
          : 'bg-transparent border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:border-indigo-300'
        }
      `}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      <div className="absolute top-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="px-3 py-1.5 text-[11px] font-semibold bg-white/90 dark:bg-zinc-900/80 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-zinc-700 rounded-md shadow-sm hover:border-indigo-300 hover:text-indigo-700"
        >
          Upload
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); tryPasteFromClipboard(); }}
          className="px-3 py-1.5 text-[11px] font-semibold bg-white/90 dark:bg-zinc-900/80 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-zinc-700 rounded-md shadow-sm hover:border-indigo-300 hover:text-indigo-700 inline-flex items-center gap-1"
        >
          <Clipboard className="w-3.5 h-3.5" /> Paste
        </button>
      </div>
      <div className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors">
        <div className={`
          p-3 rounded-full transition-transform duration-300 group-hover:-translate-y-1
          ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}
        `}>
           {isDragging ? <ArrowUpFromLine className="w-6 h-6" /> : <Upload className="w-6 h-6 opacity-60" />}
        </div>
        <div className="text-center space-y-0.5">
           <p className="text-xs font-bold uppercase tracking-wide">Upload / Paste Plot Image</p>
           <p className="text-[9px] opacity-70">Drag, click, or Cmd/Ctrl+V (PNG, JPG, WEBP)</p>
        </div>
      </div>
    </div>
  );
};