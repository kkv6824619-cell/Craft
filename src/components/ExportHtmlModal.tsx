import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Copy, Download, FileCode2, X } from 'lucide-react';
import { buildStandaloneHtml, downloadStandaloneHtml } from '../game/standaloneHtmlExport';

interface ExportHtmlModalProps {
  open: boolean;
  onClose: () => void;
}

const PLAYABLES_CHECKS = [
  'Official YouTube Playables SDK v1 script loaded first in <head>',
  'Signals firstFrameReady() and gameReady() on startup',
  'Synced with onPause(), onResume(), and onAudioEnabledChange()',
  'Cloud saveData() / loadData() + engagement.sendScore() wired',
  'Adaptive portrait (9:16) & landscape (16:9) camera with Left/Right touches',
  'Relative ./ asset paths & zero third-party fonts or external files in dist/',
];

export const ExportHtmlModal: React.FC<ExportHtmlModalProps> = ({ open, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const htmlBundle = useMemo(() => (open ? buildStandaloneHtml() : ''), [open]);
  const sizeKb = useMemo(() => {
    if (!htmlBundle) return 0;
    return Math.max(1, Math.round(new Blob([htmlBundle]).size / 1024));
  }, [htmlBundle]);

  if (!open) return null;

  const handleDownload = () => {
    downloadStandaloneHtml('turbo-tumble-3d-playables.html');
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2600);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(htmlBundle);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = htmlBundle;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/78 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/80 text-slate-100 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="export-modal-title" className="font-display text-xl font-extrabold text-white">
                YouTube Playables &amp; HTML Export
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                SDK v1 ready &middot; Single HTML ({sizeKb} KB) or Playables ZIP bundle
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-slate-950/75 border border-slate-800 p-4 space-y-2">
          <div className="text-xs font-bold text-emerald-400">
            YouTube Playables Compliance Built In
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {PLAYABLES_CHECKS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] px-4 py-3 text-sm font-bold text-white transition-all cursor-pointer whitespace-nowrap"
          >
            {downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {downloaded ? 'Downloaded HTML' : 'Download Single HTML'}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied Full HTML' : 'Copy HTML Code'}
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-slate-950/75 border border-slate-800 p-4 text-xs text-slate-300 space-y-2">
          <div className="font-semibold text-slate-200">Upload Instructions</div>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>
              <strong className="text-slate-200">YouTube Playables ZIP:</strong> Run{' '}
              <span className="font-mono-num text-amber-300">npm run build</span> and zip the
              contents of <span className="font-mono-num text-amber-300">dist/</span> (with{' '}
              <span className="font-mono-num text-slate-200">index.html</span> at the ZIP root).
              Three.js is bundled locally inside <span className="font-mono-num text-slate-200">dist/assets/</span> so there are zero external CDN requests.
            </li>
            <li>
              <strong className="text-slate-200">Komma / Single-HTML Host:</strong> Upload the
              downloaded <span className="font-mono-num text-slate-200">turbo-tumble-3d-playables.html</span> directly—no ZIP or extra files needed.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
