import { useEffect, useRef, useState, useCallback } from 'react';
import type { DiagramEngine } from '../engines';
import type { RenderResult } from '../types';

let renderSeq = 0;

export function useDiagramRenderer(
  engine: DiagramEngine,
  code: string,
  theme: string,
  debounceMs = 400,
) {
  const [result, setResult] = useState<RenderResult>({ svg: '', error: null });
  const [isRendering, setIsRendering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const latestSeq = useRef(0);

  const render = useCallback(
    async (source: string, currentEngine: DiagramEngine, currentTheme: string) => {
      if (!source.trim()) {
        setResult({ svg: '', error: null });
        return;
      }

      const seq = ++renderSeq;
      latestSeq.current = seq;
      setIsRendering(true);

      try {
        const svg = await currentEngine.render(source, {
          theme: currentTheme,
          securityLevel: 'strict',
        });

        if (seq !== latestSeq.current) return;
        setResult({ svg, error: null });
      } catch (err) {
        if (seq !== latestSeq.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        const clean = msg.replace(/<[^>]+>/g, '').trim();
        setResult({ svg: '', error: clean || 'Syntax error in diagram' });
      } finally {
        if (seq === latestSeq.current) setIsRendering(false);
      }
    },
    [],
  );

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => render(code, engine, theme), debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [code, engine, theme, debounceMs, render]);

  return { result, isRendering };
}
