import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) {
  console.log('.env already exists; preserved.');
} else {
  const password = randomBytes(24).toString('base64url');
  const email = 'owner@sdd.local';
  writeFileSync(
    '.env',
    `HOST=127.0.0.1\nPORT=3001\nAPP_ORIGIN=http://localhost:5173\nDATABASE_URL=postgresql://sdd:sdd-local-development@127.0.0.1:5433/sdd_studio\nENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nBOOTSTRAP_EMAIL=${email}\nBOOTSTRAP_PASSWORD=${password}\nOLLAMA_URL=http://127.0.0.1:11434\nDO_NOT_TRACK=1\nOPENUI_TELEMETRY_DISABLED=1\n`,
    { mode: 0o600 },
  );
  mkdirSync('.runtime', { recursive: true });
  writeFileSync(
    '.runtime/local-access.md',
    `# Local development access\n\nURL: http://localhost:5173\n\nEmail: ${email}\n\nPassword: ${password}\n\nLocal development credentials only. This file and .env are ignored by Git.\n`,
    { mode: 0o600 },
  );
  console.log('Created .env and private local access instructions in .runtime/local-access.md.');
}
