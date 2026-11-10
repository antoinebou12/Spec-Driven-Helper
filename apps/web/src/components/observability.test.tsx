import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObservabilityView } from './ObservabilityPanel';
import { sampleObservability } from '../test/observability-sample';

describe('ObservabilityView', () => {
  it('shows tiles, jobs, routes and only configured tool links', () => {
    render(<ObservabilityView data={sampleObservability} />);
    expect(screen.getByText('18,432')).toBeTruthy();
    expect(screen.getByText('≤ 250 ms')).toBeTruthy();
    expect(screen.getByText('/api/v1/projects/:id/board')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Grafana/ }).getAttribute('href')).toBe('http://localhost:3300');
    expect(screen.queryByRole('link', { name: /Netdata/ })).toBeNull();
    expect(screen.getAllByText('not configured')).toHaveLength(2);
  });

  it('flags an unreachable database', () => {
    render(<ObservabilityView data={{ ...sampleObservability, database: { ok: false, latencyMs: 0 } }} />);
    expect(screen.getByText('Unreachable').className).toContain('tone-red');
  });
});
