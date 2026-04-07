export interface ThemeOption {
  value: string;
  label: string;
}

export interface RenderOptions {
  theme: string;
  /** 'strict' for preview, 'sandbox' for export */
  securityLevel?: 'strict' | 'sandbox' | 'loose';
  fontFamily?: string;
  themeVariables?: Record<string, string>;
}

export interface DiagramEngine {
  readonly id: string;
  readonly label: string;
  readonly themes: ThemeOption[];
  readonly defaultTheme: string;
  readonly defaultCode: string;
  /** Fence language used in Google Docs code blocks, e.g. "mermaid" */
  readonly fenceLanguage: string;

  render(source: string, options: RenderOptions): Promise<string>;
}

const engines = new Map<string, DiagramEngine>();

export function registerEngine(engine: DiagramEngine) {
  engines.set(engine.id, engine);
}

export function getEngine(id: string): DiagramEngine {
  const engine = engines.get(id);
  if (!engine) throw new Error(`Unknown diagram engine: ${id}`);
  return engine;
}

export function getAllEngines(): DiagramEngine[] {
  return Array.from(engines.values());
}
