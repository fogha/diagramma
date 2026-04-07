import { useState } from 'react';
import type { RenderResult, DiagramStyle } from '../types';
import type { DiagramEngine } from '../engines';
import { CodePanel } from './CodePanel';
import { PreviewPanel } from './PreviewPanel';
import { Toolbar } from './Toolbar';
import { ActionBar } from './ActionBar';
import { StylePanel } from './StylePanel';
import { useResize } from '../hooks/useResize';

function statusClass(result: RenderResult, isRendering: boolean) {
  if (isRendering) return 'panel-status panel-status--rendering';
  if (result.error) return 'panel-status panel-status--error';
  if (result.svg) return 'panel-status panel-status--ok';
  return 'panel-status';
}

interface DiagramEditorProps {
  code: string;
  theme: string;
  syntaxId: string;
  engine: DiagramEngine;
  availableEngines: DiagramEngine[];
  result: RenderResult;
  isRendering: boolean;
  isExporting: boolean;
  exportError: string | null;
  exportSuccess: boolean;
  isGas: boolean;
  diagramStyle: DiagramStyle;
  onCodeChange: (code: string) => void;
  onThemeChange: (theme: string) => void;
  onSyntaxChange: (syntaxId: string) => void;
  onStyleChange: (style: DiagramStyle) => void;
  onSaveToDoc: () => void;
  onReplaceWithPng: () => void;
  onClose: () => void;
}

export function DiagramEditor({
  code,
  theme,
  syntaxId,
  engine,
  availableEngines,
  result,
  isRendering,
  isExporting,
  exportError,
  exportSuccess,
  isGas,
  diagramStyle,
  onCodeChange,
  onThemeChange,
  onSyntaxChange,
  onStyleChange,
  onSaveToDoc,
  onReplaceWithPng,
  onClose,
}: DiagramEditorProps) {
  const { splitPercent, containerRef, handleMouseDown } = useResize(44);
  const [showStyle, setShowStyle] = useState(false);

  return (
    <div className="editor-root">
      <Toolbar
        theme={theme}
        syntaxId={syntaxId}
        engine={engine}
        availableEngines={availableEngines}
        isGas={isGas}
        onThemeChange={onThemeChange}
        onSyntaxChange={onSyntaxChange}
        onClose={onClose}
      />

      <main className="editor-body" ref={containerRef}>
        {/* Code panel */}
        <div
          className="panel panel-code"
          style={{ width: `${splitPercent}%` }}
        >
          <div className="panel-header">
            <div className="panel-left">
              <span className={statusClass(result, isRendering)} aria-hidden="true" />
              <span className="panel-title">{engine.label}</span>
            </div>
            <span className="panel-hint">Tab ·  Ctrl+Z</span>
          </div>
          <div className="panel-content">
            <CodePanel code={code} onChange={onCodeChange} syntaxLabel={engine.label} />
          </div>
        </div>

        {/* Resize handle */}
        <div
          className="resize-handle"
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize panels"
          tabIndex={0}
        />

        {/* Preview panel */}
        <div
          className="panel panel-preview"
          style={{ flex: 1, width: `${100 - splitPercent}%` }}
        >
          <div className="panel-content" style={{ display: 'flex' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PreviewPanel
                result={result}
                isRendering={isRendering}
                onToggleStyle={() => setShowStyle((s) => !s)}
                showStyleActive={showStyle}
              />
            </div>
            {showStyle && (
              <StylePanel
                style={diagramStyle}
                onChange={onStyleChange}
                onClose={() => setShowStyle(false)}
              />
            )}
          </div>
        </div>
      </main>

      <ActionBar
        isGas={isGas}
        isExporting={isExporting}
        exportError={exportError}
        exportSuccess={exportSuccess}
        canExport={!!(result.svg && !result.error)}
        syntaxLabel={engine.label}
        onSaveToDoc={onSaveToDoc}
        onReplaceWithPng={onReplaceWithPng}
      />
    </div>
  );
}
