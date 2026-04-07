import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, dropCursor } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodePanelProps {
  code: string;
  onChange: (code: string) => void;
  syntaxLabel?: string;
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: '#0c1018',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    lineHeight: '1.7',
  },
  '.cm-content': {
    padding: '16px 0',
    caretColor: '#4d8ef8',
  },
  '.cm-line': { padding: '0 20px' },
  '.cm-gutters': {
    backgroundColor: '#0c1018',
    borderRight: '1px solid #1d2537',
    color: '#445060',
    minWidth: '44px',
  },
  '.cm-activeLineGutter': { backgroundColor: '#101520' },
  '.cm-activeLine': { backgroundColor: '#10152010' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#4d8ef8' },
  '.cm-selectionBackground': { backgroundColor: '#4d8ef822 !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#4d8ef830 !important' },
});

export function CodePanel({ code, onChange, syntaxLabel = 'Diagram' }: CodePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create editor once
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          drawSelection(),
          dropCursor(),
          highlightActiveLine(),
          history(),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          markdown(),
          oneDark,
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.lineWrapping,
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external code changes (e.g., on initial GAS data load after mount)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      });
    }
  }, [code]);

  return (
    <div
      ref={containerRef}
      className="code-panel"
      aria-label={`${syntaxLabel} code editor`}
    />
  );
}
