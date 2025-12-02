declare module 'bn.js' {
  export default class BN {
    constructor(value: string | number, base?: number)
    toString(base?: number): string
    toNumber(): number
    add(other: BN): BN
    sub(other: BN): BN
    mul(other: BN): BN
    div(other: BN): BN
    mod(other: BN): BN
    pow(other: BN): BN
    eq(other: BN): boolean
    lt(other: BN): boolean
    lte(other: BN): boolean
    gt(other: BN): boolean
    gte(other: BN): boolean
  }
}

