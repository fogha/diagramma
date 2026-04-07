interface ActionBarProps {
  isGas: boolean;
  isExporting: boolean;
  exportError: string | null;
  exportSuccess: boolean;
  canExport: boolean;
  syntaxLabel: string;
  onSaveToDoc: () => void;
  onReplaceWithPng: () => void;
}

export function ActionBar({
  isGas,
  isExporting,
  exportError,
  exportSuccess,
  canExport,
  syntaxLabel,
  onSaveToDoc,
  onReplaceWithPng,
}: ActionBarProps) {
  return (
    <footer className="action-bar" role="contentinfo">
      <div className="action-bar-left">
        {exportError && (
          <span className="action-error" role="alert">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.25" />
              <path d="M6.5 3.5v3.5M6.5 9v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            {exportError}
          </span>
        )}
        {exportSuccess && (
          <span className="action-success" role="status" aria-live="polite">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.25" />
              <path d="M4 6.5l2 2 3-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isGas ? 'Inserted into document' : 'Downloaded!'}
          </span>
        )}
      </div>

      <div className="action-bar-right">
        {isGas && (
          <button
            className="btn btn-secondary"
            onClick={onSaveToDoc}
            title={`Update the ${syntaxLabel} code block in the document`}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2 10.5h9M6.5 2v7M4 7l2.5 2.5L9 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Update Code
          </button>
        )}
        {isGas && (
          <button
            className="btn btn-primary"
            onClick={onReplaceWithPng}
            disabled={!canExport || isExporting}
            title={!canExport ? 'Fix diagram errors before exporting' : 'Replace code block with PNG image'}
          >
            {isExporting ? (
              <>
                <span className="spinner spinner-sm" aria-hidden="true" />
                Exporting…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M6.5 1.5v7M4 7l2.5 2.5L9 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Export as PNG
              </>
            )}
          </button>
        )}
        {!isGas && (
          <span className="standalone-hint">
            Open via Google Docs to export
          </span>
        )}
      </div>
    </footer>
  );
}
