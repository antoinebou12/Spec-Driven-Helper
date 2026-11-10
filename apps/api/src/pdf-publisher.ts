import type { Spec } from '../../../packages/shared/src/schema';
import { HttpError } from './projects';

export const publisherConfigured = () => !!process.env.PUBLISHER_URL && !!process.env.PUBLISHER_TOKEN;

/** Renders a specification to PDF in the isolated publisher service and checks the result. */
export async function publisherPdf(spec: Spec, signal?: AbortSignal): Promise<Buffer> {
  if (!publisherConfigured()) throw new HttpError(503, 'Configure the isolated PDF publisher service');
  const response = await fetch(`${process.env.PUBLISHER_URL}/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PUBLISHER_TOKEN}` },
    body: JSON.stringify(spec),
    signal: signal ?? AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new HttpError(502, `Publisher failed (${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 25_000_000 || data.subarray(0, 5).toString() !== '%PDF-')
    throw new HttpError(502, 'Publisher returned an invalid PDF');
  return data;
}
