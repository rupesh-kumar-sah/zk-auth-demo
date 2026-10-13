import {
  simulateZkVerificationResources,
  calculateVerificationFee,
  estimateZkVerificationFee,
  formatFeeEstimationSummary,
  SOROBAN_FEE_SCHEDULE,
} from '../src/feeEstimator';

describe('Soroban ZK Fee Estimator', () => {
  it('should simulate resource metrics with realistic Soroban limits', () => {
    const metrics = simulateZkVerificationResources(256, 2);

    expect(metrics.cpuInstructions).toBeGreaterThan(2_000_000);
    expect(metrics.cpuInstructions).toBeLessThan(100_000_000); // within Soroban tx cpu limit
    expect(metrics.memoryBytes).toBeGreaterThan(100 * 1024);
    expect(metrics.ledgerEntriesRead).toBe(2);
    expect(metrics.ledgerEntriesWritten).toBe(1);
  });

  it('should scale CPU instructions based on public signals count', () => {
    const metrics2Signals = simulateZkVerificationResources(256, 2);
    const metrics4Signals = simulateZkVerificationResources(256, 4);

    expect(metrics4Signals.cpuInstructions).toBeGreaterThan(metrics2Signals.cpuInstructions);
    expect(metrics4Signals.cpuInstructions - metrics2Signals.cpuInstructions).toBe(2 * 85_000);
  });

  it('should calculate fees accurately using Soroban fee rates', () => {
    const metrics = simulateZkVerificationResources(256, 2);
    const breakdown = calculateVerificationFee(metrics, 100);

    expect(breakdown.baseFeeStroops).toBe(100);
    expect(breakdown.cpuFeeStroops).toBeGreaterThan(0);
    expect(breakdown.memoryFeeStroops).toBeGreaterThan(0);
    expect(breakdown.storageFeeStroops).toBeGreaterThan(0);
    expect(breakdown.refundableResourceFeeStroops).toBeGreaterThan(0);
    expect(breakdown.totalFeeStroops).toBeGreaterThan(breakdown.baseFeeStroops);
    expect(parseFloat(breakdown.totalFeeXLM)).toBeGreaterThan(0);
  });

  it('should handle custom proof hex inputs and estimate fees', async () => {
    const proofHex = '0x' + 'ab'.repeat(128); // 128 bytes
    const breakdown = await estimateZkVerificationFee({
      proofHex,
      publicSignalsCount: 3,
      baseFeeStroops: 200,
    });

    expect(breakdown.baseFeeStroops).toBe(200);
    expect(breakdown.simulatedMetrics.readBytes).toBe(1024 + 128);
    expect(breakdown.totalFeeStroops).toBeGreaterThan(5000);
  });

  it('should format human-readable fee summary report', async () => {
    const breakdown = await estimateZkVerificationFee();
    const summary = formatFeeEstimationSummary(breakdown);

    expect(summary).toContain('Soroban ZK Verification Fee Estimation');
    expect(summary).toContain('Total Fee:');
    expect(summary).toContain('CPU Instructions');
    expect(summary).toContain('Stroops');
  });
});
