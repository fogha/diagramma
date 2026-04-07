import { useRef, useState, useCallback, WheelEvent, MouseEvent, useEffect, useMemo } from 'react';
import type { RenderResult } from '../types';

interface PreviewPanelProps {
  result: RenderResult;
  isRendering: boolean;
  onToggleStyle?: () => void;
  showStyleActive?: boolean;
}

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.12;
const FIT_PADDING = 32;

function getSvgDimensions(svgHtml: string): { w: number; h: number } | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgHtml, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  const svg = doc.documentElement.tagName.toLowerCase() === 'svg' ? doc.documentElement : doc.querySelector('svg');
  if (!svg) return null;

  let w = parseFloat(svg.getAttribute('width') || '');
  let h = parseFloat(svg.getAttribute('height') || '');

  if ((!w || !h) && svg.hasAttribute('viewBox')) {
    const vb = svg.getAttribute('viewBox')!.split(/[\s,]+/).map(Number);
    if (vb.length === 4) {
      w = w || vb[2];
      h = h || vb[3];
    }
  }

  if (!w || !h) return null;
  return { w, h };
}

export function PreviewPanel({ result, isRendering, onToggleStyle, showStyleActive }: PreviewPanelProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSvg = useRef('');
  const svgDataUrl = useMemo(
    () => (result.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}` : ''),
    [result.svg],
  );

  const clampZoom = useCallback(
    (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)),
    [],
  );

  const calcFitZoom = useCallback(() => {
    if (!result.svg || !containerRef.current) return 1;
    const dims = getSvgDimensions(result.svg);
    if (!dims) return 1;

    const rect = containerRef.current.getBoundingClientRect();
    const availW = rect.width - FIT_PADDING * 2;
    const availH = rect.height - FIT_PADDING * 2;
    if (availW <= 0 || availH <= 0) return 1;

    const fit = Math.min(availW / dims.w, availH / dims.h);
    return clampZoom(Math.min(fit, 1));
  }, [result.svg, clampZoom]);

  useEffect(() => {
    if (result.svg && !result.error && result.svg !== prevSvg.current) {
      prevSvg.current = result.svg;
      setZoom(calcFitZoom());
      setPan({ x: 0, y: 0 });
    }
  }, [result.svg, result.error, calcFitZoom]);

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      setZoom((z) => clampZoom(z * factor));
    },
    [clampZoom],
  );

  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent<HTMLDivElement>) => {
    isPanning.current = false;
    e.currentTarget.style.cursor = 'grab';
  }, []);

  const handleMouseLeave = useCallback((e: MouseEvent<HTMLDivElement>) => {
    isPanning.current = false;
    e.currentTarget.style.cursor = 'grab';
  }, []);

  const fitToScreen = useCallback(() => {
    setZoom(calcFitZoom());
    setPan({ x: 0, y: 0 });
  }, [calcFitZoom]);

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z * (1 + ZOOM_STEP * 2))), [clampZoom]);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z / (1 + ZOOM_STEP * 2))), [clampZoom]);

  const hasContent = result.svg && !result.error;

  return (
    <div className="preview-panel">
      {/* Header with title + zoom pill controls */}
      <div className="panel-header panel-header--preview">
        <div className="panel-left">
          <span className="panel-title">Preview</span>
        </div>

        {onToggleStyle && (
          <button
            className={`style-toggle-btn ${showStyleActive ? 'style-toggle-btn--active' : ''}`}
            onClick={onToggleStyle}
            aria-label="Toggle export style settings"
            title="Export style (PNG only)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0" />
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z" />
            </svg>
          </button>
        )}

        {/* Zoom pill */}
        <div className="preview-controls" role="group" aria-label="Zoom controls">
          <button
            className="preview-btn"
            onClick={zoomOut}
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN}
          >
            −
          </button>
          <span className="zoom-label" aria-live="polite" aria-atomic="true">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="preview-btn"
            onClick={zoomIn}
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
          >
            +
          </button>
          <div className="preview-divider" aria-hidden="true" />
          <button
            className="preview-btn preview-btn--text"
            onClick={fitToScreen}
            aria-label="Fit diagram to screen"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="preview-canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'grab' }}
        aria-label="Diagram preview — scroll to zoom, drag to pan"
      >
        {isRendering && (
          <div className="preview-state preview-rendering" role="status" aria-live="polite">
            <span className="spinner spinner-accent" aria-hidden="true" />
            <span>Rendering…</span>
          </div>
        )}

        {!isRendering && result.error && (
          <div className="preview-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="9" cy="9" r="8" stroke="#f85149" strokeWidth="1.4" />
              <path d="M9 5.5v4M9 12v.5" stroke="#f85149" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <div>
              <p className="error-title">Syntax error</p>
              <p className="error-body">{result.error}</p>
            </div>
          </div>
        )}

        {!isRendering && !result.error && !result.svg && (
          <div className="preview-state">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="28" height="28" rx="5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 3" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.5" />
              <circle cx="24" cy="12" r="2.5" fill="currentColor" fillOpacity="0.5" />
              <circle cx="18" cy="24" r="2.5" fill="currentColor" fillOpacity="0.5" />
              <path d="M12 12L18 24M24 12L18 24M12 12H24" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p>Start typing to see your diagram</p>
          </div>
        )}

        {!isRendering && hasContent && (
          <div
            className="preview-diagram"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '50% 50%',
            }}
          >
            <img src={svgDataUrl} alt="Rendered diagram preview" draggable={false} />
          </div>
        )}
      </div>
    </div>
  );
}
