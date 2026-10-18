import { hash, parseOptions, verify, type Algorithm } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import type { Argon2Params } from './config';

// Argon2id = 2 (const enum ambiente não pode ser importado com isolatedModules).
const ARGON2ID = 2 as Algorithm;

export interface PasswordHasher {
  hash(senha: string): Promise<string>;
  verify(phc: string, senha: string): Promise<boolean>;
  /** true quando o hash foi gerado com parâmetros mais fracos que os atuais (rehash no login). */
  needsRehash(phc: string): boolean;
  /** Gasta o mesmo tempo de uma verificação real (e-mail inexistente no login). */
  verifyDummy(senha: string): Promise<void>;
}

export function createPasswordHasher(params: Argon2Params): PasswordHasher {
  const options = {
    algorithm: ARGON2ID,
    memoryCost: params.memoryKiB,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
  };
  // Aquecido na criação: o primeiro login com e-mail inexistente não paga o custo do hash.
  const dummy = hash(randomBytes(16).toString('hex'), options);
  dummy.catch(() => undefined);

  return {
    hash: (senha) => hash(senha, options),
    async verify(phc, senha) {
      try {
        return await verify(phc, senha);
      } catch {
        return false;
      }
    },
    needsRehash(phc) {
      try {
        const current = parseOptions(phc);
        return (
          current.algorithm !== ARGON2ID ||
          current.memoryCost < params.memoryKiB ||
          current.timeCost < params.timeCost ||
          current.parallelism < params.parallelism
        );
      } catch {
        return true;
      }
    },
    async verifyDummy(senha) {
      await verify(await dummy, senha).catch(() => false);
    },
  };
}
