export interface SorobanSimulationMetrics {
  cpuInstructions: number;
  memoryBytes: number;
  readBytes: number;
  writeBytes: number;
  ledgerEntriesRead: number;
  ledgerEntriesWritten: number;
}

export interface FeeEstimationParams {
  proofBytesLength?: number;
  proofHex?: string;
  publicSignalsCount?: number;
  baseFeeStroops?: number;
  rpcEndpoint?: string;
}

export interface FeeBreakdown {
  baseFeeStroops: number;
  cpuFeeStroops: number;
  memoryFeeStroops: number;
  storageFeeStroops: number;
  refundableResourceFeeStroops: number;
  totalFeeStroops: number;
  totalFeeXLM: string;
  simulatedMetrics: SorobanSimulationMetrics;
}

// Current Soroban Network Fee Schedule Rates (in Stroops: 1 XLM = 10,000,000 Stroops)
export const SOROBAN_FEE_SCHEDULE = {
  DEFAULT_BASE_FEE: 100, // 100 Stroops
  STROOPS_PER_10K_CPU_INSTRUCTIONS: 25,
  STROOPS_PER_KB_RAM: 50,
  STROOPS_PER_KB_READ: 100,
  STROOPS_PER_KB_WRITE: 1000,
  ENTRY_READ_FLAT: 500,
  ENTRY_WRITE_FLAT: 2500,
  REFUNDABLE_FEE_BUFFER_PERCENT: 15,
};

/**
 * Simulates Soroban RPC resource consumption for Groth16/BN128 verification.
 */
export function simulateZkVerificationResources(
  proofLengthBytes: number = 256,
  publicSignalsCount: number = 2
): SorobanSimulationMetrics {
  // Elliptic curve pairing checks on BN128 curve inside Soroban contract
  // Baseline: ~1.8M - 2.5M CPU instructions for 2 pairing operations + linear cost per public signal
  const baseCpu = 2_150_000;
  const cpuPerSignal = 85_000;
  const cpuInstructions = baseCpu + (publicSignalsCount * cpuPerSignal);

  // Memory required: Contract state + proof deserialization + temporary curve point allocations
  const baseMemory = 128 * 1024; // 128 KB
  const memoryBytes = baseMemory + (proofLengthBytes * 4);

  // Ledger footprint: Verification key reading + nullifier deduplication check / write
  const readBytes = 1024 + proofLengthBytes;
  const writeBytes = 64; // nullifier record write
  const ledgerEntriesRead = 2; // AuthVerifier Contract Instance + Verification Key
  const ledgerEntriesWritten = 1; // Nullifier mapping entry

  return {
    cpuInstructions,
    memoryBytes,
    readBytes,
    writeBytes,
    ledgerEntriesRead,
    ledgerEntriesWritten,
  };
}

/**
 * Calculates fee breakdown from Soroban resource consumption metrics.
 */
export function calculateVerificationFee(
  metrics: SorobanSimulationMetrics,
  customBaseFee?: number
): FeeBreakdown {
  const baseFeeStroops = customBaseFee !== undefined ? customBaseFee : SOROBAN_FEE_SCHEDULE.DEFAULT_BASE_FEE;

  // CPU instructions fee
  const cpuFeeStroops = Math.ceil(
    (metrics.cpuInstructions / 10_000) * SOROBAN_FEE_SCHEDULE.STROOPS_PER_10K_CPU_INSTRUCTIONS
  );

  // RAM fee
  const memoryFeeStroops = Math.ceil(
    (metrics.memoryBytes / 1024) * SOROBAN_FEE_SCHEDULE.STROOPS_PER_KB_RAM
  );

  // Storage and ledger entry I/O fee
  const storageReadFee = Math.ceil((metrics.readBytes / 1024) * SOROBAN_FEE_SCHEDULE.STROOPS_PER_KB_READ);
  const storageWriteFee = Math.ceil((metrics.writeBytes / 1024) * SOROBAN_FEE_SCHEDULE.STROOPS_PER_KB_WRITE);
  const entryReadFee = metrics.ledgerEntriesRead * SOROBAN_FEE_SCHEDULE.ENTRY_READ_FLAT;
  const entryWriteFee = metrics.ledgerEntriesWritten * SOROBAN_FEE_SCHEDULE.ENTRY_WRITE_FLAT;
  const storageFeeStroops = storageReadFee + storageWriteFee + entryReadFee + entryWriteFee;

  // Resource refundable buffer (15% safety margin required by Soroban RPC simulation)
  const nonRefundableTotal = baseFeeStroops + cpuFeeStroops + memoryFeeStroops + storageFeeStroops;
  const refundableResourceFeeStroops = Math.ceil(
    (nonRefundableTotal * SOROBAN_FEE_SCHEDULE.REFUNDABLE_FEE_BUFFER_PERCENT) / 100
  );

  const totalFeeStroops = nonRefundableTotal + refundableResourceFeeStroops;
  const totalFeeXLM = (totalFeeStroops / 10_000_000).toFixed(7);

  return {
    baseFeeStroops,
    cpuFeeStroops,
    memoryFeeStroops,
    storageFeeStroops,
    refundableResourceFeeStroops,
    totalFeeStroops,
    totalFeeXLM,
    simulatedMetrics: metrics,
  };
}

/**
 * Helper function to estimate Soroban transaction fees for ZK proof verification calls.
 */
export async function estimateZkVerificationFee(
  params: FeeEstimationParams = {}
): Promise<FeeBreakdown> {
  let proofLengthBytes = params.proofBytesLength || 256;
  if (params.proofHex) {
    const cleanHex = params.proofHex.startsWith('0x') ? params.proofHex.slice(2) : params.proofHex;
    proofLengthBytes = Math.ceil(cleanHex.length / 2);
  }

  const publicSignalsCount = params.publicSignalsCount !== undefined ? params.publicSignalsCount : 2;
  const metrics = simulateZkVerificationResources(proofLengthBytes, publicSignalsCount);

  return calculateVerificationFee(metrics, params.baseFeeStroops);
}

/**
 * Formats a fee breakdown into a concise human-readable summary.
 */
export function formatFeeEstimationSummary(breakdown: FeeBreakdown): string {
  return [
    `=== Soroban ZK Verification Fee Estimation ===`,
    `Total Fee: ${breakdown.totalFeeXLM} XLM (${breakdown.totalFeeStroops} Stroops)`,
    `- Base Fee: ${breakdown.baseFeeStroops} Stroops`,
    `- CPU Instructions (${breakdown.simulatedMetrics.cpuInstructions.toLocaleString()} instrs): ${breakdown.cpuFeeStroops} Stroops`,
    `- Memory (${Math.round(breakdown.simulatedMetrics.memoryBytes / 1024)} KB): ${breakdown.memoryFeeStroops} Stroops`,
    `- Ledger I/O: ${breakdown.storageFeeStroops} Stroops`,
    `- Refundable Buffer: ${breakdown.refundableResourceFeeStroops} Stroops`,
  ].join('\n');
}
