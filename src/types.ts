export interface GasContext {
  /** Whether we're running inside a Google Apps Script dialog */
  isGas: boolean;
  /** The diagram source code passed from the document */
  initialCode: string;
  /** Index of the diagram block in the document (for replace-back) */
  blockIndex: number;
  /** Which diagram syntax this block uses (e.g. 'mermaid') */
  syntax: string;
}

export interface RenderResult {
  svg: string;
  error: string | null;
}

export interface DiagramStyle {
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  lineColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  background: string;
  fontFamily: string;
  useBackground: boolean;
}

export const DEFAULT_STYLE: DiagramStyle = {
  primaryColor: '#4d8ef8',
  primaryTextColor: '#ffffff',
  primaryBorderColor: '#3679e8',
  lineColor: '#8495aa',
  secondaryColor: '#1a2233',
  tertiaryColor: '#141b27',
  background: '#0c1018',
  fontFamily: 'Inter, "Trebuchet MS", sans-serif',
  useBackground: true,
};

export interface DiagramMeta {
  type: 'diagramma';
  syntax: string;
  source: string;
  theme: string;
  version: string;
  createdAt: string;
  style?: DiagramStyle;
}
