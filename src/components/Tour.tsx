import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { t } from '../lib/i18n';

/**
 * A guided walk over the real interface: each step dims the page, cuts a hole
 * around one element and explains it next to it. Targets are given as a list of
 * selectors because the same control lives in different places on desktop and
 * mobile; the first visible one wins.
 */
export interface TourStep {
  target: string[];
  title: string;
  body: string;
}

const HOLE_PAD = 8;
const EDGE = 14;

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export default function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [cardSize, setCardSize] = useState({ width: 320, height: 180 });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const findTarget = useCallback(() => {
    for (const selector of step.target) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el as HTMLElement;
    }
    return null;
  }, [step]);

  const measure = useCallback(() => {
    const el = findTarget();
    setRect(el ? el.getBoundingClientRect() : null);
  }, [findTarget]);

  /* Bring the target into view, then track it while the page moves. */
  useEffect(() => {
    findTarget()?.scrollIntoView({ block: 'center', inline: 'nearest' });
    const frame = requestAnimationFrame(measure);
    const settle = window.setTimeout(measure, 140);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [index, findTarget, measure]);

  useEffect(() => {
    const onMove = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      measure();
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [measure]);

  /* Keep the card's measured height current so it can flip above the target. */
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const read = () => setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Focus the primary action on every step, and restore it when the tour ends. */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cardRef.current?.querySelector<HTMLElement>('[data-tour-primary]')?.focus();
    return () => previous?.focus?.();
  }, [index]);

  const finish = useCallback(() => onDone(), [onDone]);

  function next() {
    if (last) finish();
    else setIndex((i) => i + 1);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      finish();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      setIndex((i) => i - 1);
    } else if (event.key === 'Tab') {
      const buttons = [...(cardRef.current?.querySelectorAll<HTMLElement>('button') ?? [])];
      if (buttons.length === 0) return;
      const first = buttons[0];
      const lastButton = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const width = Math.min(340, viewport.width - EDGE * 2);
  let cardStyle: CSSProperties;
  if (rect) {
    /* Beside the target when it fits, otherwise away from its heading. */
    const gap = 14;
    const roomBelow = viewport.height - rect.bottom - gap;
    const roomAbove = rect.top - gap;
    let top: number;
    if (roomBelow >= cardSize.height) top = rect.bottom + gap;
    else if (roomAbove >= cardSize.height) top = rect.top - cardSize.height - gap;
    else top = rect.top < viewport.height / 2 ? viewport.height - cardSize.height - EDGE : EDGE;
    cardStyle = {
      width,
      top: clamp(top, EDGE, viewport.height - cardSize.height - EDGE),
      left: clamp(rect.left + rect.width / 2 - width / 2, EDGE, viewport.width - width - EDGE),
    };
  } else {
    cardStyle = {
      width,
      top: viewport.height / 2 - cardSize.height / 2,
      left: viewport.width / 2 - width / 2,
    };
  }

  return (
    <div
      className="sk-tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sk-tour-title"
      onKeyDown={onKeyDown}
    >
      {rect ? (
        <div
          className="sk-tour-hole"
          aria-hidden="true"
          style={{
            top: rect.top - HOLE_PAD,
            left: rect.left - HOLE_PAD,
            width: rect.width + HOLE_PAD * 2,
            height: rect.height + HOLE_PAD * 2,
          }}
        />
      ) : (
        <div className="sk-tour-dim" aria-hidden="true" />
      )}

      <div className="sk-tour-card" ref={cardRef} style={cardStyle}>
        <div className="sk-tour-dots" aria-label={`Langkah ${index + 1} dari ${steps.length}`}>
          {steps.map((_, i) => (
            <span key={i} data-on={i === index} />
          ))}
        </div>
        <h2 className="sk-tour-title" id="sk-tour-title">
          {t(step.title)}
        </h2>
        <p className="sk-tour-body">{t(step.body)}</p>
        <div className="sk-tour-actions">
          <button type="button" className="sk-tour-skip" onClick={finish}>{t("Lewati")}</button>
          <div className="sk-tour-next-group">
            {index > 0 ? (
              <button type="button" className="sk-tour-back" onClick={() => setIndex((i) => i - 1)}>{t("Kembali")}</button>
            ) : null}
            <button type="button" className="sk-tour-primary" data-tour-primary onClick={next}>
              {last ? 'Selesai' : t("Lanjut")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
