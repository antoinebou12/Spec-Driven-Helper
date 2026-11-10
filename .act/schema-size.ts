import { z } from 'zod';
import { aiResultSchema } from '../apps/api/src/providers';
const s = z.toJSONSchema(aiResultSchema, { io: 'input', unrepresentable: 'any' });
const text = JSON.stringify(s);
console.log('schema chars', text.length);
console.log(text.slice(0, 1500));
