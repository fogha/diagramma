import type { DiagramEngine } from '../engines';

interface ToolbarProps {
  theme: string;
  syntaxId: string;
  engine: DiagramEngine;
  availableEngines: DiagramEngine[];
  isGas: boolean;
  onThemeChange: (theme: string) => void;
  onSyntaxChange: (syntaxId: string) => void;
  onClose: () => void;
}

export function Toolbar({
  theme,
  syntaxId,
  engine,
  availableEngines,
  isGas,
  onThemeChange,
  onSyntaxChange,
  onClose,
}: ToolbarProps) {
  const showSyntaxPicker = availableEngines.length > 1;

  return (
    <header className="toolbar" role="banner">
      <div className="toolbar-brand">
        {/* Node-graph brand mark */}
        <div className="brand-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="3" r="2" fill="white" fillOpacity="0.95" />
            <circle cx="3" cy="13" r="2" fill="white" fillOpacity="0.70" />
            <circle cx="13" cy="13" r="2" fill="white" fillOpacity="0.70" />
            <path d="M8 5L3 11M8 5L13 11M3 11.5h10" stroke="white" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="brand-name">Diagramma</span>
        {!isGas && <span className="brand-badge">Demo</span>}
      </div>

      <div className="toolbar-controls">
        {/* Syntax picker — only shown when multiple engines are registered */}
        {showSyntaxPicker && (
          <>
            <label className="theme-label" htmlFor="syntax-select">Syntax</label>
            <select
              id="syntax-select"
              className="theme-select"
              value={syntaxId}
              onChange={(e) => onSyntaxChange(e.target.value)}
              aria-label="Diagram syntax"
            >
              {availableEngines.map((eng) => (
                <option key={eng.id} value={eng.id}>{eng.label}</option>
              ))}
            </select>
            <div className="toolbar-sep" aria-hidden="true" />
          </>
        )}

        {/* Theme picker — options come from the active engine */}
        <label className="theme-label" htmlFor="theme-select">Theme</label>
        <select
          id="theme-select"
          className="theme-select"
          value={theme}
          onChange={(e) => onThemeChange(e.target.value)}
          aria-label="Diagram theme"
        >
          {engine.themes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {isGas && (
          <>
            <div className="toolbar-sep" aria-hidden="true" />
            <button
              className="close-btn"
              onClick={onClose}
              aria-label="Close editor"
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
