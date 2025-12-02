declare module 'keccak' {
  function keccak(algorithm: string): {
    update(data: Buffer | Uint8Array | string): this
    digest(encoding?: 'hex' | 'buffer'): string | Buffer
  }
  export = keccak
}

