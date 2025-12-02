import * as nearAPI from 'near-api-js';
import BN from 'bn.js';
import dotenv from 'dotenv';
dotenv.config();
const {
    Near,
    Account,
    keyStores,
    KeyPair,
    transactions: { functionCall },
} = nearAPI;
const {
    NEAR_PROXY_CONTRACT_ID,
    NEAR_ACCOUNT_ID,
    NEAR_PRIVATE_KEY,
    NEAR_PROXY_ACCOUNT,
    NEAR_PROXY_CONTRACT,
    NEAR_PROXY_ACCOUNT_ID,
    NEAR_PROXY_PRIVATE_KEY,
} = process.env;

const isProxyCall = NEAR_PROXY_CONTRACT === 'true';
const accountId =NEAR_PROXY_ACCOUNT_ID ;
const contractId = NEAR_PROXY_CONTRACT_ID;
const privateKey = NEAR_PROXY_PRIVATE_KEY;
const keyStore = new keyStores.InMemoryKeyStore();
keyStore.setKey('mainnet', accountId as string, KeyPair.fromString(privateKey as string));

console.log('Near Chain Signature (NCS) call details:');
console.log('Near accountId', accountId);
console.log('NCS contractId', contractId);

const config = {
    networkId:'mainnet',
    keyStore: keyStore,
    nodeUrl: 'https://rpc.mainnet.near.org',
    walletUrl: 'https://mynearwallet.com/',
    helperUrl: 'https://helper.mainnet.near.org',
    explorerUrl: 'https://nearblocks.io', 
};
export const near = new Near(config as any);
export const account = new Account(near.connection, accountId as string);
export async function sign(payload: any, path: string) {
    const args = {
        request: {
            payload,
            path,
            key_version: 0,
        },
    };
    const proxyArgs = {
        request: {
            rlp_payload: undefined,
            path,
            key_version: 0,
        }
       
    };
    let attachedDeposit = nearAPI.utils.format.parseNearAmount('1');

    if (isProxyCall) {
        proxyArgs.request.rlp_payload = payload.substring(2);
        attachedDeposit = nearAPI.utils.format.parseNearAmount('1');
    }

    console.log(
        'sign payload',
        payload.length > 200 ? payload.length : payload.toString(),
    );
    console.log('with path', path);
    console.log('this may take approx. 30 seconds to complete');
    console.log('argument to sign: ', isProxyCall ? proxyArgs : args);

    // Debugging multiple action calls

    // if (isProxyCall) {
    //     return console.log('cannot do this mod as proxy call');
    // }
    // // finalArgs are just your args to call sign
    // const finalArgs = args;
    // const actions = [];
    // for (let i = 0; i < 1; i++) {
    //     // DEBUGGING copy args and modify payload slightly
    //     const args = JSON.parse(JSON.stringify(finalArgs));
    //     if (i > 0) {
    //         args.request.payload.pop();
    //         args.request.payload.push(i);
    //     }
    //     actions.push(
    //         functionCall(
    //             'sign',
    //             args,
    //             new BN('100000000000000'),
    //             new BN(attachedDeposit),
    //         ),
    //     );
    // }

    // let res: nearAPI.providers.FinalExecutionOutcome;
    // try {
    //     // receiverId is the NEAR MPC CONTRACT
    //     res = await account.signAndSendTransaction({
    //         receiverId: contractId,
    //         actions,
    //     });
    // } catch (e) {
    //     throw new Error(`error signing ${JSON.stringify(e)}`);
    // }

    // console.log('NEAR RESPONSE', res);

    // return;

    let res: nearAPI.providers.FinalExecutionOutcome;
    try {
        res = await account.functionCall({
            contractId: contractId as string,
            methodName: 'sign',
            args: isProxyCall ? proxyArgs : args,
            gas: new BN('300000000000000'),
            attachedDeposit: new BN(attachedDeposit as string),
        });
    } catch (e) {
        throw new Error(`error signing ${JSON.stringify(e)}`);
    }

    // parse result into signature values we need r, s but we don't need first 2 bytes of r (y-parity)
    if ('SuccessValue' in (res.status as any)) {
        const successValue = (res.status as any).SuccessValue;
        const decodedValue = Buffer.from(successValue, 'base64').toString();
        console.log('decoded value: ', decodedValue);
        const { big_r, s: S, recovery_id } = JSON.parse(decodedValue);
        const r = Buffer.from(big_r.affine_point.substring(2), 'hex');
        const s = Buffer.from(S.scalar, 'hex');

        return {
            r,
            s,
            v: recovery_id,
        };
    } else {
        
        throw new Error(`error signing ${JSON.stringify(res)}`);
    }
}