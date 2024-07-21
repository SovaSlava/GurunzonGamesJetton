import { Address, 
    beginCell, 
    Cell, 
    Contract, 
    contractAddress, 
    ContractProvider, 
    Sender, 
    SendMode,
    toNano,
    BitBuilder,
    TupleBuilder } from '@ton/ton';
import {  Dictionary, DictionaryKey, DictionaryKeyTypes, DictionaryValue , Slice } from "@ton/core";
import { Sha256 } from "@aws-crypto/sha256-js";
const path = require('path')
const fs = require('fs');
import {Op} from './JettonConstants';

export type JettonConfig = {
    owner: Address;
    name: string;
    symbol: string;
    image: string;
    description: string;
    decimals: string;
    uri: string;
};


//export const JETTON_WALLET_CODE = Cell.fromBoc(walletHex.hex)[0];
//export const JETTON_MINTER_CODE = Cell.fromBoc(minterHex.hex)[0]; // code cell from build output

//export const JETTON_WALLET_CODE = Cell.fromBoc(JSON.parse(fs.readFileSync(path.join(__dirname, 
//    "../build/jetton-wallet.compiled.json"), "utf8")).hex)[0];

export const JETTON_WALLET_CODE = Cell.fromBoc(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname, 
  "../build/jetton-wallet.compiled.json"), "utf8")).hex,'hex'))[0];
export const JETTON_MINTER_CODE = Cell.fromBoc(Buffer.from(JSON.parse(fs.readFileSync(path.join(__dirname, 
    "../build/jetton-minter.compiled.json"), "utf8")).hex,'hex'))[0];

// new
const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;
const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);


export enum OPS {
  Transfer = 0xf8a7ea5,
  Transfer_notification = 0x7362d09c,
  Internal_transfer = 0x178d4519,
  Excesses = 0xd53276db,
  Burn = 0x595f07bc,
  Burn_notification = 0x7bdd97de,
  ClaimRewards = 0x5a3e000,
  ClaimRewardsNotification = 0x5a3e001,
  Mint = 0x642b7d07,
  InternalTransfer = 0x178d4519,
}
export type JettonMetaDataKeys = "name" | "description" | "image" | "decimals" | "symbol" | "uri";

const jettonOnChainMetadataSpec: {
    [key in JettonMetaDataKeys]: "utf8" | "ascii"  | undefined;
  } = {
    name: "utf8",
    description: "utf8",
    image: "ascii",
    decimals: "utf8",
    symbol: "utf8",
    uri: "ascii"
   // decimals: "utf8"
  };

const sha256 = (str: string) => {
    const sha = new Sha256();
    sha.update(str);
    return Buffer.from(sha.digestSync());
  };


   export function buildTokenMetadataCell(data: { [s: string]: string | undefined }): Cell {
    const dict = Dictionary.empty();

    Object.entries(data).forEach(([k, v]: [string, string | undefined]) => {
        if (!jettonOnChainMetadataSpec[k as JettonMetaDataKeys]) throw new Error(`Unsupported onchain key: ${k}`);
        if (v === undefined || v === '') return;

        let bufferToStore = Buffer.from(v, jettonOnChainMetadataSpec[k as JettonMetaDataKeys]);

        const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);

        let rootCell = new Cell();
        const builder = new BitBuilder();
        builder.writeUint(ONCHAIN_CONTENT_PREFIX, 8);
        let currentCell = rootCell;

        while (bufferToStore.length > 0) {
            builder.writeBuffer(bufferToStore.slice(0, CELL_MAX_SIZE_BYTES));
            bufferToStore = bufferToStore.slice(CELL_MAX_SIZE_BYTES);
            if (bufferToStore.length > 0) {
                const newCell = new Cell();
                currentCell.refs.push(newCell);
                currentCell = newCell;
            }
        }

        rootCell = rootCell.asBuilder().storeBits(builder.build()).endCell();

        dict.set(sha256(k), rootCell);
    });

    return beginCell()
        .storeInt(ONCHAIN_CONTENT_PREFIX, 8)
        .storeDict(dict, Dictionary.Keys.Buffer(32), Dictionary.Values.Cell())
        .endCell();
}







  export function jettonMinterInitData(
    owner: Address,
    metadata: { [s in JettonMetaDataKeys]?: string }
  ): Cell {
    return beginCell()
      .storeCoins(0)
      .storeAddress(owner)
      .storeRef(buildTokenMetadataCell(metadata))
      .storeRef(JETTON_WALLET_CODE)
      .endCell();
  }


  
  // return the op that should be sent to the contract on deployment, can be "null" to send an empty message
  export function initMessage() {
    return null; // TODO?
  }
  

//
export class Jetton implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Jetton(address);
    }

    static createFromConfig(config: JettonConfig, code: Cell, workchain = 0) {
      const initData:Cell = jettonMinterInitData(config.owner, {
        name: config.name,
        symbol: config.symbol,
        image: config.image,
        description: config.description,
        decimals: config.decimals,
        uri: config.uri
        });
      
        const init = { code:code, data:initData };
        return new Jetton(contractAddress(workchain, init), init);
    }
/*
    static transferMessage(to:Address, jetton_amount:bigint, from, response_addr, customPayload, forward_ton_amount:bigint, total_ton_amount) {
      const transferMsg = beginCell().storeUint(Op.internal_transfer, 32)
          .storeUint(0, 64)
          .storeCoins(jetton_amount)
          .storeAddress(from)
          .storeAddress(response)
          .storeCoins(forward_ton_amount)
          .storeMaybeRef(customPayload)
          .endCell();
      
      return beginCell().storeUint(Op.transfer, 32).storeUint(0, 64) // op, queryId
      .storeCoins(jetton_amount)
      .storeAddress(to)
      .storeAddress(from)
      .storeMaybeRef(null)
      .storeCoins(forward_ton_amount)

  
      .storeRef(transferMsg)
      .endCell();
    }

*/
    static mintMessage(to: Address, jetton_amount: bigint, from?: Address | null, response?: Address | null, customPayload?: Cell | null, forward_ton_amount: bigint = 0n, total_ton_amount: bigint = 0n) {
      const mintMsg = beginCell().storeUint(Op.internal_transfer, 32)
          .storeUint(0, 64)
          .storeCoins(jetton_amount)
       //   .storeAddress(from)
       //   .storeAddress(response)
      //    .storeCoins(forward_ton_amount)
       //   .storeMaybeRef(customPayload)
          .endCell();
      return beginCell().storeUint(Op.mint, 32).storeUint(0, 64) // op, queryId
          .storeAddress(to)
       //   .storeCoins(total_ton_amount)
       .storeCoins(jetton_amount)
          .endCell();
  }


    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async get2(provider: ContractProvider) {
      const result = await provider.get('get3', []);
      return result.stack.readNumber();
  }
  async get_jetton_data(provider: ContractProvider) {
    let { stack } = await provider.get('get_jetton_data', []);
    return {
        total_supply: stack.readBigNumber(),
        i: stack.readBigNumber(),
        admin_address: stack.readAddress()
       // content: stack.readCell,
       // wallet_code: stack.readCell()
    }
  }

  async sendMint(
    provider: ContractProvider,
    via: Sender,
    opts: {
        amount: bigint;
        to: Address;
    }
) {
    await provider.internal(via, {
        value: toNano('0.05'), // fee with gas
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell()
            .storeUint(OPS.Mint, 32) // opcode (reference TODO)
            .storeUint(0, 64) // queryid
            .storeAddress(opts.to)
            .storeCoins(toNano('0.02')) // gas fee
            .storeRef(
                // internal transfer message
                beginCell()
                    .storeUint(OPS.InternalTransfer, 32)
                    .storeUint(0, 64)
                    .storeCoins(opts.amount)
                    .storeAddress(null) // TODO FROM?
                    .storeAddress(null) // TODO RESP?
                    .storeCoins(0)
                    .storeBit(false) // forward_payload in this slice, not separate cell
                    .endCell()
            )
            .endCell(),
    });
}

  
  async getWalletAddressOfUser(provider: ContractProvider, userAddress: Address) {
    const tb = new TupleBuilder();
    tb.writeAddress(userAddress);
    const result = await provider.get('get_wallet_address', tb.build());
    return result.stack.readAddress();
  }


}
