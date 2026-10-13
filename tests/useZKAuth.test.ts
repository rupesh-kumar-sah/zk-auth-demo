import { renderHook, act } from '@testing-library/react-hooks';
import { useZKAuth, verifyAuthProof } from '../src/hooks/useZKAuth';
import * as prover from '../src/prover';

describe('useZKAuth Hook', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with default states', () => {
      const { result } = renderHook(() => useZKAuth());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isGeneratingProof).toBe(false);
      expect(result.current.isVerifying).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.proof).toBeNull();
      expect(typeof result.current.authenticate).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Successful Authentication', () => {
    it('should authenticate successfully with a string secret', async () => {
      const { result } = renderHook(() => useZKAuth());

      let authResult: prover.ProverOutput | null = null;
      await act(async () => {
        authResult = await result.current.authenticate('my-secret-token');
      });

      expect(authResult).not.toBeNull();
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isGeneratingProof).toBe(false);
      expect(result.current.isVerifying).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.proof).toEqual(authResult);
      expect(result.current.proof?.proof.startsWith('0x')).toBe(true);
      expect(result.current.proof?.publicSignals.length).toBe(2);
    });

    it('should authenticate successfully with ProverInput object', async () => {
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.authenticate({
          secret: '0xabcdef123456',
          appId: 'stellar-dao-v1',
          merkleProof: ['0x1111', '0x2222'],
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.proof).not.toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should trigger onSuccess callback when authentication succeeds', async () => {
      const onSuccessMock = jest.fn();
      const { result } = renderHook(() => useZKAuth({ onSuccess: onSuccessMock }));

      await act(async () => {
        await result.current.authenticate('test-secret');
      });

      expect(onSuccessMock).toHaveBeenCalledTimes(1);
      expect(onSuccessMock).toHaveBeenCalledWith(expect.objectContaining({
        proof: expect.any(String),
        publicSignals: expect.any(Array),
      }));
    });
  });

  describe('Error Handling', () => {
    it('should reject when secret is empty', async () => {
      const onErrorMock = jest.fn();
      const { result } = renderHook(() => useZKAuth({ onError: onErrorMock }));

      let output: prover.ProverOutput | null = null;
      await act(async () => {
        output = await result.current.authenticate('');
      });

      expect(output).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Secret must be a non-empty string');
      expect(onErrorMock).toHaveBeenCalledTimes(1);
    });

    it('should handle proof generation failure gracefully', async () => {
      jest.spyOn(prover, 'generateAuthProof').mockRejectedValueOnce(new Error('Prover circuit failure'));

      const onErrorMock = jest.fn();
      const { result } = renderHook(() => useZKAuth({ onError: onErrorMock }));

      await act(async () => {
        await result.current.authenticate('valid-secret');
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isGeneratingProof).toBe(false);
      expect(result.current.error).toBe('Prover circuit failure');
      expect(onErrorMock).toHaveBeenCalledTimes(1);
    });

    it('should fail when custom verifier returns false', async () => {
      const customVerifier = jest.fn().mockResolvedValue(false);
      const { result } = renderHook(() => useZKAuth({ verifier: customVerifier }));

      await act(async () => {
        await result.current.authenticate('valid-secret');
      });

      expect(customVerifier).toHaveBeenCalledTimes(1);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toContain('Zero-Knowledge proof verification failed');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all states back to initial values', async () => {
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.authenticate('test-secret');
      });
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.proof).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isGeneratingProof).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.proof).toBeNull();
    });
  });

  describe('verifyAuthProof Utility', () => {
    it('should validate correctly formatted Groth16 mock proofs', () => {
      const mockHex = Buffer.from('Groth16Proof:nullifier:root:random').toString('hex');
      expect(verifyAuthProof('0x' + mockHex, ['nullifier', 'root'])).toBe(true);
    });

    it('should return false for invalid proof format or empty public signals', () => {
      expect(verifyAuthProof('', ['signal'])).toBe(false);
      expect(verifyAuthProof('0x1234', [])).toBe(false);
      const invalidHex = Buffer.from('InvalidHeader:123').toString('hex');
      expect(verifyAuthProof('0x' + invalidHex, ['signal'])).toBe(false);
    });
  });
});
