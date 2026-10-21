// Exports the built-in UI strings to the backend seed file.
// Run after adding new keys to src/i18n/ru.ts: `npm run export-texts`.
// The backend inserts keys that are missing in the database and never overwrites edited ones.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ru } from '../src/i18n/ru.ts';
import { flatten } from '../src/i18n/flatten.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '../../backend/Govori.Api/Content/ui.ru.json');
const texts = flatten(ru);
writeFileSync(out, JSON.stringify(texts, null, 2) + '\n');
console.log(`Wrote ${Object.keys(texts).length} texts to ${out}`);
