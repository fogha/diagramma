import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getEngine, getAllEngines } from './engines';
import type { DiagramEngine } from './engines';
import type { GasContext, DiagramMeta, DiagramStyle } from './types';
import { DEFAULT_STYLE } from './types';
import { useDiagramRenderer } from './hooks/useDiagramRenderer';
import { DiagramEditor } from './components/DiagramEditor';

const DEFAULT_SYNTAX = 'mermaid';

function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function parseUrlGasContext(): GasContext | null {
  const params = new URLSearchParams(window.location.search);
  const isGas = params.get('gas') === '1';
  if (!isGas) return null;
  const codeRaw = params.get('code') ?? '';
  return {
    isGas: true,
    initialCode: decodeURIComponent(codeRaw),
    blockIndex: parseInt(params.get('block') ?? '0', 10),
    syntax: params.get('syntax') ?? DEFAULT_SYNTAX,
  };
}

function extractSvgDimensions(svgEl: Element): { w: number; h: number } {
  let w = 0;
  let h = 0;

  // Mermaid often sets width="100%" with the real size in style="max-width: 800px"
  const style = svgEl.getAttribute('style') || '';
  const maxWMatch = style.match(/max-width:\s*([\d.]+)\s*px/);
  if (maxWMatch) w = parseFloat(maxWMatch[1]);

  // Try explicit width/height attributes (skip percentage values)
  const attrW = svgEl.getAttribute('width') || '';
  const attrH = svgEl.getAttribute('height') || '';
  if (!w && attrW && !attrW.includes('%')) w = parseFloat(attrW);
  if (!h && attrH && !attrH.includes('%')) h = parseFloat(attrH);

  // Fall back to viewBox
  if ((!w || !h) && svgEl.hasAttribute('viewBox')) {
    const vb = svgEl.getAttribute('viewBox')!.split(/[\s,]+/).map(Number);
    if (vb.length === 4) {
      w = w || vb[2];
      h = h || vb[3];
    }
  }

  // If we got width from style/viewBox but no height, derive from viewBox aspect ratio
  if (w && !h && svgEl.hasAttribute('viewBox')) {
    const vb = svgEl.getAttribute('viewBox')!.split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0) {
      h = w * (vb[3] / vb[2]);
    }
  }

  return { w: w || 800, h: h || 600 };
}

function svgToPngBase64(svgString: string, scale = 2, bgColor = '#ffffff'): Promise<string> {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = svgDoc.documentElement;

  const { w, h } = extractSvgDimensions(svgEl);

  // Set explicit pixel dimensions so the rasterizer uses the correct size
  svgEl.setAttribute('width', String(w));
  svgEl.setAttribute('height', String(h));
  svgEl.removeAttribute('style');

  const serialized = new XMLSerializer().serializeToString(svgEl);
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load SVG for PNG conversion'));
    img.src = dataUrl;
  });
}

export function App() {
  const trustedParentOrigin = useMemo(() => getOrigin(document.referrer), []);
  const [gasCtx, setGasCtx] = useState<GasContext>(
    () => parseUrlGasContext() ?? {
      isGas: false,
      initialCode: getEngine(DEFAULT_SYNTAX).defaultCode,
      blockIndex: 0,
      syntax: DEFAULT_SYNTAX,
    },
  );
  const gasCtxRef = useRef(gasCtx);
  gasCtxRef.current = gasCtx;

  const [syntaxId, setSyntaxId] = useState(gasCtx.syntax);
  const engine: DiagramEngine = getEngine(syntaxId);
  const availableEngines = getAllEngines();

  const [code, setCode] = useState(gasCtx.initialCode);
  const [theme, setTheme] = useState(engine.defaultTheme);
  const [diagramStyle, setDiagramStyle] = useState<DiagramStyle>(DEFAULT_STYLE);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const isCustomStyle = JSON.stringify(diagramStyle) !== JSON.stringify(DEFAULT_STYLE);

  const postToParent = useCallback(
    (message: Record<string, unknown>) => {
      if (!trustedParentOrigin) {
        throw new Error('Unable to verify the host window origin.');
      }
      window.parent.postMessage(message, trustedParentOrigin);
    },
    [trustedParentOrigin],
  );

  const themeVariables = useMemo(() => {
    if (!isCustomStyle) return undefined;
    return {
      primaryColor: diagramStyle.primaryColor,
      primaryTextColor: diagramStyle.primaryTextColor,
      primaryBorderColor: diagramStyle.primaryBorderColor,
      lineColor: diagramStyle.lineColor,
      secondaryColor: diagramStyle.secondaryColor,
      tertiaryColor: diagramStyle.tertiaryColor,
      background: diagramStyle.useBackground ? diagramStyle.background : '#ffffff',
      fontFamily: diagramStyle.fontFamily,
    };
  }, [diagramStyle, isCustomStyle]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent) return;
      if (trustedParentOrigin && e.origin !== trustedParentOrigin) return;
      if (!e.data?.type) return;

      if (e.data.type === 'diagramma-gas-context') {
        const { isGas, blockIndex, code: srcCode, syntax, style: savedStyle } = e.data.payload;
        if (!gasCtxRef.current.isGas && isGas) {
          const resolvedSyntax = syntax ?? DEFAULT_SYNTAX;
          const ctx: GasContext = { isGas: true, initialCode: srcCode, blockIndex, syntax: resolvedSyntax };
          setGasCtx(ctx);
          setCode(srcCode);
          setSyntaxId(resolvedSyntax);
          setTheme(getEngine(resolvedSyntax).defaultTheme);
          if (savedStyle) setDiagramStyle(savedStyle);
        }
        if (trustedParentOrigin) {
          window.parent.postMessage({ type: 'diagramma-gas-context-ack' }, trustedParentOrigin);
        }
      }

      if (e.data.type === 'diagramma-action-success') {
        setExportSuccess(true);
        setIsExporting(false);
        setTimeout(() => setExportSuccess(false), 3000);
      }

      if (e.data.type === 'diagramma-action-error') {
        setExportError(e.data.message);
        setIsExporting(false);
        setTimeout(() => setExportError(null), 5000);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [trustedParentOrigin]);

  const handleSyntaxChange = useCallback((newSyntaxId: string) => {
    const newEngine = getEngine(newSyntaxId);
    setSyntaxId(newSyntaxId);
    setTheme(newEngine.defaultTheme);
    setCode(newEngine.defaultCode);
  }, []);

  const { result, isRendering } = useDiagramRenderer(engine, code, theme);

  const handleSaveToDoc = useCallback(() => {
    if (!gasCtxRef.current.isGas) return;
    postToParent({
      type: 'diagramma-update-code',
      code,
      syntax: syntaxId,
      blockIndex: gasCtxRef.current.blockIndex,
    });
  }, [code, syntaxId, postToParent]);

  const handleReplaceWithPng = useCallback(async () => {
    if (!code.trim() || result.error) return;
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);
    try {
      const exportSvg = await engine.render(code, {
        theme,
        securityLevel: 'sandbox',
        themeVariables,
      });
      const exportBg = diagramStyle.useBackground ? diagramStyle.background : '#ffffff';
      const base64 = await svgToPngBase64(exportSvg, 2, exportBg);

      const meta: DiagramMeta = {
        type: 'diagramma',
        syntax: syntaxId,
        source: code,
        theme,
        version: '0.1.0',
        createdAt: new Date().toISOString(),
        style: isCustomStyle ? diagramStyle : undefined,
      };
      postToParent({
        type: 'diagramma-replace-png',
        base64,
        meta: JSON.stringify(meta),
        blockIndex: gasCtxRef.current.blockIndex,
      });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
      setIsExporting(false);
    }
  }, [result.error, code, theme, engine, syntaxId, themeVariables, diagramStyle, isCustomStyle, postToParent]);

  return (
    <DiagramEditor
      code={code}
      theme={theme}
      syntaxId={syntaxId}
      engine={engine}
      availableEngines={availableEngines}
      result={result}
      isRendering={isRendering}
      isExporting={isExporting}
      exportError={exportError}
      exportSuccess={exportSuccess}
      isGas={gasCtx.isGas}
      diagramStyle={diagramStyle}
      onCodeChange={setCode}
      onThemeChange={setTheme}
      onSyntaxChange={handleSyntaxChange}
      onStyleChange={setDiagramStyle}
      onSaveToDoc={handleSaveToDoc}
      onReplaceWithPng={handleReplaceWithPng}
      onClose={() => {
        if (!trustedParentOrigin) return;
        window.parent.postMessage({ type: 'diagramma-close' }, trustedParentOrigin);
      }}
    />
  );
}
