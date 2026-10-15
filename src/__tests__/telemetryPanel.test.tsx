import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TelemetryPanel } from '../components/TelemetryPanel';
import { TelemetrySummary, TelemetryPoint } from '../types';

const summary: TelemetrySummary = {
  vibration: { current: 12, baseline: 8, delta_pct: 50, unit: 'mm/s RMS', status: 'CRITICAL' },
  temperature: { current: 72, baseline: 60, delta_pct: 20, unit: '°C', status: 'CRITICAL' },
  motor_current: { current: 24, baseline: 20, delta_pct: 20, unit: 'A', status: 'WARNING' },
  rpm: { current: 3400, baseline: 3400, delta_pct: 0, unit: 'RPM', status: 'NORMAL' },
  pressure: { current: 4, baseline: 4, delta_pct: 0, unit: 'bar', status: 'NORMAL' },
};

const series: TelemetryPoint[] = [
  { timestamp: '2026-10-01T08:00:00Z', display_time: '08:00', vibration: 8, temperature: 60, motor_current: 20, rpm: 3400, pressure: 4 },
  { timestamp: '2026-10-01T14:00:00Z', display_time: '14:00', vibration: 12, temperature: 72, motor_current: 24, rpm: 3400, pressure: 4, is_anomalous: true },
];

describe('TelemetryPanel', () => {
  it('graphs the selected sensor and updates scrubbed degradation against its baseline', () => {
    render(<TelemetryPanel summary={summary} timeSeries={series} />);

    expect(screen.getByLabelText('Telemetry trend to graph')).toHaveValue('vibration');
    expect(screen.getByText('+50.0% vs baseline')).toBeInTheDocument();

    const scrubber = screen.getByRole('slider');
    fireEvent.change(scrubber, { target: { value: '0' } });
    expect(screen.getByText('+0.0% vs baseline')).toBeInTheDocument();

    fireEvent.change(scrubber, { target: { value: '1' } });
    expect(screen.getByText('+50.0% vs baseline')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Telemetry trend to graph'), { target: { value: 'temperature' } });
    expect(screen.getByText((_, element) => element?.textContent === 'Temperature at 14:00: 72.0 °C')).toBeInTheDocument();
    expect(screen.getByText('+20.0% vs baseline')).toBeInTheDocument();
  });
});
