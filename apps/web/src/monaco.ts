import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/editor/editor.all.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

// Monaco is bundled with the application instead of loading from a CDN, so self-hosted and
// air-gapped installations work and the Content-Security-Policy can stay `script-src 'self'`.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
export { monaco };
