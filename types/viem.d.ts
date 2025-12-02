declare module 'viem' {
  export interface PublicClient {
    // Public client interface
    [key: string]: any
  }

  export interface HttpTransport {
    // HTTP transport interface
    [key: string]: any
  }

  export function createPublicClient(config: {
    transport: HttpTransport
  }): PublicClient

  export function http(url: string): HttpTransport
}

