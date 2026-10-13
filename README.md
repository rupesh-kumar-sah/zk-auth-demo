<div align="center">
  <h1>zk-auth-demo</h1>
  <p><strong>Zero-Knowledge Identity & Authentication System for Soroban Smart Contracts.</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Circom](https://img.shields.io/badge/Circom-2.1-red)](https://docs.circom.io)
  [![Groth16](https://img.shields.io/badge/ZK--SNARK-Groth16-green)](#)
  [![Soroban](https://img.shields.io/badge/Soroban-On--Chain%20Verifier-purple)](https://soroban.stellar.org)
</div>

<br />

## 📖 Overview

`zk-auth-demo` showcases privacy-preserving authentication and identity verification on Stellar's Soroban platform using Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (**Groth16 ZK-SNARKs**).

Users generate proofs client-side in the browser (or Node.js) using Circom circuits, which are then verified on-chain by a Soroban smart contract using Stellar's native cryptographic host functions. The system protects against proof replay attacks via a Poseidon-based nullifier construction and supports anonymous whitelist verification through Merkle membership proofs.

---

## 🏗️ Architecture & Proving Pipeline

```
+-------------------------------------------------------------------------+
|                              User Browser                               |
|  1. Enter Private Input (Secret / Identity Commitment)                 |
|  2. Generate Groth16 Proof via snarkjs & WASM Circuit                   |
+-------------------------------------------------------------------------+
                                   |
                                   v (Proof Bytes & Public Signals)
+-------------------------------------------------------------------------+
|                     Soroban Smart Contract Verifier                     |
|  +------------------------+  +---------------------------------------+  |
|  | Groth16 Host Verifier  |  | Nullifier Double-Spend Check          |  |
|  +------------------------+  +---------------------------------------+  |
|  +-------------------------------------------------------------------+  |
|  | Merkle Root Membership Validation                                 |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
                                   |
                                   v
                      [ Access Granted / Transaction Executed ]
```

---

## 🔒 Cryptographic Primitives & Circuit Design

- **Poseidon Nullifier Circuit**: Computes `Nullifier = Poseidon(Secret, AppID)`. Prevents proof replay attacks without revealing the user's secret key or identity commitment.
- **Merkle Membership Proof Circuit**: Proves membership in a 16-depth Merkle tree (allowlist / KYC registry) in $O(\log N)$ constraint complexity.
- **Trusted Setup & Ceremony Tooling**: Includes reproducible Powers of Tau scripts and verification tooling for `.zkey` artifacts.

---

## 💡 Code & Integration Example

### 1. React Frontend Integration (`useZKAuth` Hook)

The `useZKAuth` custom hook abstracts away complex state management, proof generation, and verification into a clean React API:

```tsx
import React, { useState } from 'react';
import { useZKAuth } from './hooks/useZKAuth';

export function ZKAuthComponent() {
  const [secret, setSecret] = useState('');
  const {
    authenticate,
    isLoading,
    isGeneratingProof,
    isAuthenticated,
    error,
    proof,
    reset
  } = useZKAuth({
    defaultAppId: 'stellar-dao-v1',
    onSuccess: (result) => console.log('Authenticated successfully!', result),
    onError: (err) => console.error('Authentication failed:', err.message),
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await authenticate(secret);
  };

  return (
    <div className="auth-card">
      {isAuthenticated ? (
        <div>
          <h3>Authenticated Successfully!</h3>
          <p>Nullifier Hash: <code>{proof?.publicSignals[0]}</code></p>
          <button onClick={reset}>Reset</button>
        </div>
      ) : (
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Enter secret key..."
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <button type="submit" disabled={isLoading}>
            {isGeneratingProof
              ? 'Generating ZK Proof...'
              : isLoading
              ? 'Verifying...'
              : 'Authenticate with ZK'}
          </button>
          {error && <p className="error" style={{ color: 'red' }}>{error}</p>}
        </form>
      )}
    </div>
  );
}
```

### 2. Generating Proof in JavaScript / Browser (Core SDK)

```typescript
import { generateAuthProof } from '@sharif-stellar-tools/zk-auth-demo';

const { proof, publicSignals } = await generateAuthProof({
  secret: '0x123456789abcdef...',
  appId: 'stellar-dao-v1',
  merkleProof: siblingPath,
});

console.log('Generated Proof:', proof);
console.log('Nullifier Hash:', publicSignals[0]);
```

### 3. On-Chain Soroban Verification Call

```rust
// Soroban Smart Contract Entrypoint
pub fn verify_and_authenticate(
    env: Env,
    proof_bytes: Bytes,
    public_inputs: Vec<Val>,
) -> Result<bool, Error> {
    // Check nullifier hasn't been spent
    let nullifier = public_inputs.get(0).unwrap();
    if env.storage().persistent().has(&nullifier) {
        return Err(Error::NullifierAlreadyUsed);
    }

    // Perform Groth16 verification using host crypto primitives
    let is_valid = env.crypto().groth16_verify(&proof_bytes, &public_inputs);
    if is_valid {
        env.storage().persistent().set(&nullifier, &true);
    }
    
    Ok(is_valid)
}
```

---

## 🚀 Build, Benchmark & Setup Instructions

### Prerequisites

- **Circom 2.1+**: `cargo install --git https://github.com/iden3/circom.git`
- **snarkjs**: `npm install -g snarkjs`
- **Soroban CLI**: `cargo install --locked soroban-cli`

### Compile Circuits & Perform Setup

```bash
# Clone the repository
git clone https://github.com/sharif-stellar-tools/zk-auth-demo.git
cd zk-auth-demo

# Compile Circom circuits
npm run build:circuits

# Run trusted setup ceremony verification
npm run ceremony:verify

# Run circuit benchmarks (measures constraints & proof generation time)
npm run bench
```

---

## 🛣️ Roadmap & Active GitHub Issues

- [[Feature] Implement nullifier-based double-spend prevention for ZK proofs](https://github.com/sharif-stellar-tools/zk-auth-demo/issues/1)
- [[Feature] Add Merkle membership proof circuit for anonymous allowlist verification](https://github.com/sharif-stellar-tools/zk-auth-demo/issues/2)
- [[Performance] Benchmark and optimise circuit constraint count for faster proof generation](https://github.com/sharif-stellar-tools/zk-auth-demo/issues/3)
- [[Tooling] Add a ceremony CLI for reproducing and verifying the trusted setup](https://github.com/sharif-stellar-tools/zk-auth-demo/issues/4)
- [[Integration] Connect ZK proof verification to Stellar Soroban smart contract](https://github.com/sharif-stellar-tools/zk-auth-demo/issues/5)

---

## 📄 License

Licensed under the MIT License. See [LICENSE](./LICENSE) for details.
