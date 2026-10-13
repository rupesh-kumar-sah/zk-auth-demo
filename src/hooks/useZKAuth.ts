import { useState, useCallback, useRef, useEffect } from 'react';
import { generateAuthProof, ProverInput, ProverOutput } from '../prover';

export interface UseZKAuthOptions {
  /**
   * Default application identifier if none is provided during authenticate()
   * @default 'default'
   */
  defaultAppId?: string;

  /**
   * Custom verifier function to execute after proof generation
   */
  verifier?: (proof: string, publicSignals: string[]) => Promise<boolean> | boolean;

  /**
   * Callback invoked when authentication succeeds
   */
  onSuccess?: (output: ProverOutput) => void;

  /**
   * Callback invoked when authentication fails
   */
  onError?: (error: Error) => void;
}

export interface UseZKAuthReturn {
  /**
   * Triggers proof generation and verification for the provided credentials
   */
  authenticate: (input: string | ProverInput) => Promise<ProverOutput | null>;

  /**
   * Overall loading state (true during proof generation or verification)
   */
  isLoading: boolean;

  /**
   * Specifically true during zero-knowledge proof generation
   */
  isGeneratingProof: boolean;

  /**
   * Specifically true during proof verification
   */
  isVerifying: boolean;

  /**
   * True if authentication and verification were successful
   */
  isAuthenticated: boolean;

  /**
   * Holds error message if authentication failed, or null otherwise
   */
  error: string | null;

  /**
   * Holds the generated proof and public signals when authenticated
   */
  proof: ProverOutput | null;

  /**
   * Resets all authentication states to initial values
   */
  reset: () => void;
}

/**
 * Validates whether proof payload conforms to expected Groth16 format
 */
export function verifyAuthProof(proof: string, publicSignals: string[]): boolean {
  if (!proof || typeof proof !== 'string') {
    return false;
  }

  if (!publicSignals || !Array.isArray(publicSignals) || publicSignals.length === 0) {
    return false;
  }

  try {
    const rawHex = proof.startsWith('0x') ? proof.slice(2) : proof;
    const decoded = Buffer.from(rawHex, 'hex').toString('utf8');
    return decoded.startsWith('Groth16Proof');
  } catch {
    return false;
  }
}

/**
 * Custom React hook encapsulating Zero-Knowledge proof generation,
 * verification, and state management.
 */
export function useZKAuth(options: UseZKAuthOptions = {}): UseZKAuthReturn {
  const { defaultAppId = 'default', verifier, onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingProof, setIsGeneratingProof] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProverOutput | null>(null);

  // Track component mounted status to prevent updating unmounted state
  const isMountedRef = useRef<boolean>(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsLoading(false);
    setIsGeneratingProof(false);
    setIsVerifying(false);
    setIsAuthenticated(false);
    setError(null);
    setProof(null);
  }, []);

  const authenticate = useCallback(
    async (input: string | ProverInput): Promise<ProverOutput | null> => {
      const normalizedInput: ProverInput =
        typeof input === 'string'
          ? { secret: input, appId: defaultAppId }
          : { ...input, appId: input.appId || defaultAppId };

      if (!normalizedInput.secret || typeof normalizedInput.secret !== 'string' || normalizedInput.secret.trim() === '') {
        const validationError = new Error('Secret must be a non-empty string');
        if (isMountedRef.current) {
          setError(validationError.message);
          setIsAuthenticated(false);
          setIsLoading(false);
          setIsGeneratingProof(false);
          setIsVerifying(false);
        }
        onError?.(validationError);
        return null;
      }

      if (isMountedRef.current) {
        setIsLoading(true);
        setIsGeneratingProof(true);
        setIsVerifying(false);
        setError(null);
      }

      try {
        // Step 1: Generate Groth16 Zero-Knowledge proof
        const generatedProof = await generateAuthProof(normalizedInput);

        if (isMountedRef.current) {
          setIsGeneratingProof(false);
          setIsVerifying(true);
        }

        // Step 2: Verification step (custom verifier or built-in validation)
        const isValid = verifier
          ? await verifier(generatedProof.proof, generatedProof.publicSignals)
          : verifyAuthProof(generatedProof.proof, generatedProof.publicSignals);

        if (!isValid) {
          throw new Error('Zero-Knowledge proof verification failed');
        }

        if (isMountedRef.current) {
          setProof(generatedProof);
          setIsAuthenticated(true);
          setIsVerifying(false);
          setIsLoading(false);
          setError(null);
        }

        onSuccess?.(generatedProof);
        return generatedProof;
      } catch (err: any) {
        const resolvedError = err instanceof Error ? err : new Error(String(err));
        if (isMountedRef.current) {
          setError(resolvedError.message);
          setIsAuthenticated(false);
          setIsGeneratingProof(false);
          setIsVerifying(false);
          setIsLoading(false);
        }
        onError?.(resolvedError);
        return null;
      }
    },
    [defaultAppId, verifier, onSuccess, onError]
  );

  return {
    authenticate,
    isLoading,
    isGeneratingProof,
    isVerifying,
    isAuthenticated,
    error,
    proof,
    reset,
  };
}

export default useZKAuth;
