import mermaid from 'mermaid';
import type { DiagramEngine, RenderOptions, ThemeOption } from './DiagramEngine';
import { registerEngine } from './DiagramEngine';

let renderSeq = 0;

const THEMES: ThemeOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'dark', label: 'Dark' },
  { value: 'forest', label: 'Forest' },
  { value: 'neutral', label: 'Neutral' },
];

const mermaidEngine: DiagramEngine = {
  id: 'mermaid',
  label: 'Mermaid',
  themes: THEMES,
  defaultTheme: 'dark',
  fenceLanguage: 'mermaid',

  defaultCode: `flowchart TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- No --> D[Debug]
    D --> A
    C --> E[Ship it 🚀]`,

  async render(source: string, options: RenderOptions): Promise<string> {
    const hasCustomVars = options.themeVariables && Object.keys(options.themeVariables).length > 0;
    mermaid.initialize({
      startOnLoad: false,
      theme: hasCustomVars ? 'base' : options.theme as Parameters<typeof mermaid.initialize>[0]['theme'],
      themeVariables: hasCustomVars ? options.themeVariables : undefined,
      securityLevel: options.securityLevel ?? 'strict',
      fontFamily: options.fontFamily ?? 'Inter, "Trebuchet MS", sans-serif',
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
      journey: { useMaxWidth: false },
      timeline: { useMaxWidth: false },
      class: { useMaxWidth: false },
      state: { useMaxWidth: false },
      er: { useMaxWidth: false },
      pie: { useMaxWidth: false },
      quadrantChart: { useMaxWidth: false },
      xyChart: { useMaxWidth: false },
      mindmap: { useMaxWidth: false },
      gitGraph: { useMaxWidth: false },
      c4: { useMaxWidth: false },
      sankey: { useMaxWidth: false },
      block: { useMaxWidth: false },
      packet: { useMaxWidth: false },
      architecture: { useMaxWidth: false },
      kanban: { useMaxWidth: false },
    });

    const id = `diagramma-render-${++renderSeq}`;
    const { svg } = await mermaid.render(id, source);
    return svg;
  },
};

registerEngine(mermaidEngine);

export default mermaidEngine;
