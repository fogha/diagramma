import type { DiagramStyle } from '../types';
import { DEFAULT_STYLE } from '../types';

interface StylePanelProps {
  style: DiagramStyle;
  onChange: (style: DiagramStyle) => void;
  onClose: () => void;
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className="style-row">
      <label className="style-label">{label}</label>
      <div className="style-color-wrap">
        <input
          type="color"
          className="style-color-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="style-color-hex">{value}</span>
      </div>
    </div>
  );
}

const FONT_OPTIONS = [
  { value: 'Inter, "Trebuchet MS", sans-serif', label: 'Inter' },
  { value: '"Trebuchet MS", Verdana, sans-serif', label: 'Trebuchet MS' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: '"Georgia", serif', label: 'Georgia' },
  { value: '"Comic Sans MS", cursive', label: 'Comic Sans' },
  { value: 'system-ui, sans-serif', label: 'System' },
];

export function StylePanel({ style, onChange, onClose }: StylePanelProps) {
  const update = <K extends keyof DiagramStyle>(key: K, value: DiagramStyle[K]) => {
    onChange({ ...style, [key]: value });
  };

  const isDefault = JSON.stringify(style) === JSON.stringify(DEFAULT_STYLE);

  return (
    <div className="style-panel">
      <div className="style-panel-header">
        <div>
          <span className="style-panel-title">Export Style</span>
          <span className="style-panel-subtitle">PNG only</span>
        </div>
        <button className="style-panel-close" onClick={onClose} aria-label="Close style panel">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="style-panel-body">
        <div className="style-section">
          <div className="style-section-title">Nodes</div>
          <ColorRow label="Fill" value={style.primaryColor} onChange={(v) => update('primaryColor', v)} />
          <ColorRow label="Text" value={style.primaryTextColor} onChange={(v) => update('primaryTextColor', v)} />
          <ColorRow label="Border" value={style.primaryBorderColor} onChange={(v) => update('primaryBorderColor', v)} />
        </div>

        <div className="style-section">
          <div className="style-section-title">Edges</div>
          <ColorRow label="Lines" value={style.lineColor} onChange={(v) => update('lineColor', v)} />
        </div>

        <div className="style-section">
          <div className="style-section-title">Canvas</div>
          <ColorRow label="Background" value={style.background} onChange={(v) => update('background', v)} />
          <div className="style-row">
            <label className="style-label">Show background</label>
            <button
              className={`style-toggle ${style.useBackground ? 'style-toggle--on' : ''}`}
              onClick={() => update('useBackground', !style.useBackground)}
              aria-pressed={style.useBackground}
              aria-label="Toggle background"
            >
              <span className="style-toggle-thumb" />
            </button>
          </div>
          <ColorRow label="Secondary" value={style.secondaryColor} onChange={(v) => update('secondaryColor', v)} />
          <ColorRow label="Tertiary" value={style.tertiaryColor} onChange={(v) => update('tertiaryColor', v)} />
        </div>

        <div className="style-section">
          <div className="style-section-title">Typography</div>
          <div className="style-row">
            <label className="style-label">Font</label>
            <select
              className="style-select"
              value={style.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="style-reset-btn"
          onClick={() => onChange(DEFAULT_STYLE)}
          disabled={isDefault}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
