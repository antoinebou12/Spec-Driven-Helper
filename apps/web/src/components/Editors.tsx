import '../monaco';
import Editor, { DiffEditor } from '@monaco-editor/react';

/** Monaco-based editors, loaded on demand to keep the initial bundle small. */
const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'light');
// Prose editing: no word completion popups, which would swallow keystrokes while typing.
const base = {
  minimap: { enabled: false },
  wordWrap: 'on' as const,
  fontSize: 14,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  wordBasedSuggestions: 'off' as const,
  acceptSuggestionOnEnter: 'off' as const,
};

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  readOnly,
  label,
  language = 'markdown',
  height = '100%',
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
  label: string;
  language?: string;
  height?: string;
}) {
  return (
    <div className="editor-frame" style={{ height }}>
      {/* Uncontrolled: the parent remounts (via key) for external changes, so a lagging value
          prop can never overwrite keystrokes that are still being processed. */}
      <Editor
        defaultValue={value}
        language={language}
        theme={theme()}
        options={{ ...base, readOnly, ariaLabel: label, lineNumbers: 'off', tabFocusMode: true }}
        onChange={(v) => onChange(v ?? '')}
        onMount={(editor) => {
          if (onBlur) editor.onDidBlurEditorWidget(onBlur);
        }}
      />
    </div>
  );
}

export function DiffView({
  original,
  modified,
  height = '320px',
  label,
}: {
  original: string;
  modified: string;
  height?: string;
  label: string;
}) {
  return (
    <div className="editor-frame" style={{ height }} aria-label={label} role="region">
      <DiffEditor
        original={original}
        modified={modified}
        language="markdown"
        theme={theme()}
        options={{ ...base, readOnly: true, renderSideBySide: window.innerWidth > 900, originalEditable: false }}
      />
    </div>
  );
}
