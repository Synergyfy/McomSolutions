import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { privacySections, termsSections } from '../../pages/LegalPage';

type LegalKind = 'terms' | 'privacy';

export default function LegalConsentDialog({ kind, onAccept, onClose }: { kind: LegalKind; onAccept: () => void; onClose: () => void }) {
  const terms = kind === 'terms';
  const title = terms ? 'Terms of Service' : 'Privacy Policy';
  const sections = terms ? termsSections : privacySections;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const check = () => setAtBottom(node.scrollHeight <= node.clientHeight + 1 || node.scrollTop + node.clientHeight >= node.scrollHeight - 2);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    window.addEventListener('resize', check);
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { observer.disconnect(); window.removeEventListener('resize', check); document.body.style.overflow = priorOverflow; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-white sm:items-center sm:bg-slate-950/55 sm:p-5 sm:backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="legal-consent-title" className="flex h-dvh max-h-dvh w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[min(88dvh,820px)] sm:max-w-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-600">Please read before agreeing</p><h2 id="legal-consent-title" className="mt-1 text-xl font-bold text-slate-950">{title}</h2></div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <div ref={scrollRef} tabIndex={0} aria-label={`${title} document; scroll to read all`} onScroll={(event) => { const node = event.currentTarget; setAtBottom(node.scrollHeight <= node.clientHeight + 1 || node.scrollTop + node.clientHeight >= node.scrollHeight - 2); }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 sm:px-7">
          <div className="space-y-6">{sections.map((section) => <section key={section.title}><h3 className="mb-2 text-sm font-bold text-slate-900">{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mb-2 text-sm leading-6 text-slate-600">{paragraph}</p>)}</section>)}</div>
          <p className="mt-7 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">Read to the end, then use the button below to record your decision.</p>
        </div>
        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs"><span className="text-slate-500">{atBottom ? 'You have reached the end.' : 'Scroll to the end to continue.'}</span><Link to={terms ? '/terms' : '/privacy'} target="_blank" onClick={onClose} className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline">Open full page<ArrowUpRight className="h-3 w-3" /></Link></div>
          <button type="button" disabled={!atBottom} onClick={onAccept} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Check className="mr-2 h-4 w-4" />{terms ? 'I Agree' : 'I Understand'}</button>
        </footer>
      </section>
    </div>
  );
}
