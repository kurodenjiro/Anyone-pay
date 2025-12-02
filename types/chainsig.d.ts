declare module 'chainsig.js' {
  export namespace contracts {
    export class ChainSignatureContract {
      constructor(config: { networkId: string; contractId: string })
      sign(params: {
        payloads: string[] | number[][]
        path: string
        keyType: string
        signerAccount: { accountId: string }
      }): Promise<Array<{ r: string; s: string; v: number }>>
    }
  }

  export namespace chainAdapters {
    export namespace evm {
      export class EVM {
        constructor(config: {
          publicClient: any
          contract: contracts.ChainSignatureContract
        })
        prepareTransactionForSigning(params: {
          from: string
          to: string
          value: bigint
          data?: string
          gasLimit?: bigint
          gasPrice?: bigint
        }): Promise<{ transaction: any; hashesToSign: string[] }>
        prepareTransactionForSigningLegacy(params: {
          from: string
          to: string
          value: bigint
          data?: string
          gasPrice?: bigint
          gas?: bigint
        }): Promise<{ transaction: any; hashesToSign: string[] }>
        finalizeTransactionSigning(params: {
          transaction: any
          rsvSignatures: Array<{ r: string; s: string; v: number }>
          chainId?: number
        }): any
        finalizeTransactionSigningLegacy(params: {
          transaction: any
          rsvSignatures: Array<{ r: string; s: string; v: number }>
        }): any
        deriveAddressAndPublicKey(
          signedAccountId: string,
          derivationPath: string
        ): Promise<{ address: string; publicKey?: string }>
      }
    }
  }
}

