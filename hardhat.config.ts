import { resolve } from 'path'

import * as dotenv from 'dotenv'
import 'hardhat-deploy'
import 'solidity-coverage'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@layerzerolabs/toolbox-hardhat'
import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'
dotenv.config({ path: resolve(__dirname, '.env') })

import './type-extensions'

import '@typechain/hardhat'
import './tasks/create-test-data'
import './tasks/bridge-helper'
import './tasks/contract-deployer'

// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
    ? { mnemonic: MNEMONIC }
    : PRIVATE_KEY
      ? [PRIVATE_KEY]
      : undefined

console.log('MNEMONIC', MNEMONIC)
console.log('PRIVATE_KEY', PRIVATE_KEY)
console.log('accounts', accounts)
if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
    )
}

const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.27',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        'sepolia-testnet': {
            eid: EndpointId.SEPOLIA_V2_TESTNET,
            url: process.env.RPC_URL_SEPOLIA || 'https://rpc.sepolia.org/',
            accounts,
            configOption: {
                endpoint: '0x6EDCE65403992e310A62460808c4b910D972f10f',
                sendLib: '0xcc1ae8Cf5D3904Cef3360A9532B477529b177cCE',
                receiveLib: '0xdAf00F5eE2158dD58E0d3857851c432E34A3A851',
                executor: '0x718B92b5CB0a5552039B593faF724D182A881eDA',
            },
        },
        'metis-testnet': {
            eid: EndpointId.METISSEP_V2_TESTNET,
            url: 'https://sepolia.metisdevops.link',
            accounts,
        },
        'bsc-testnet': {
            eid: EndpointId.BSC_V2_TESTNET,
            url: process.env.RPC_URL_BSC_TESTNET || 'https://bsc-testnet-rpc.publicnode.com',
            accounts,
            configOption: {
                endpoint: '0x6EDCE65403992e310A62460808c4b910D972f10f',
                sendLib: '0x55f16c442907e86D764AFdc2a07C2de3BdAc8BB7',
                receiveLib: '0x188d4bbCeD671A7aA2b5055937F79510A32e9683',
                executor: '0x31894b190a8bAbd9A067Ce59fde0BfCFD2B18470',
            },
        },
        'bsc-mainnet': {
            eid: EndpointId.BSC_V2_MAINNET,
            url: process.env.RPC_URL_BSC_MAINNET || 'https://bsc.meowrpc.com',
            accounts,
            configOption: {
                endpoint: '0x1a44076050125825900e736c501f859c50fE728c',
                sendLib: '0x9f8c645f2d0b2159767bd6e0839de4be49e823de',
                receiveLib: '0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1',
                executor: '0x3ebD570ed38B1b3b4BC886999fcF507e9D584859',
            },
        },
        hardhat: {
            // Need this for testing because TestHelperOz5.sol is exceeding the compiled contract size limit
            allowUnlimitedContractSize: true,
        },
        localhost: {
            url: 'http://127.0.0.1:8545',
        },
        dev: {
            url: 'http://localhost:8545',
            chainId: 1337,
        },
        testnet: {
            url: 'https://rpc.testnet.goat.network',
            chainId: 48815,
            accounts,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // wallet address of index[0], of the mnemonic in .env
        },
    },
    typechain: {
        outDir: 'typechain-types',
        target: 'ethers-v6',
    },
}

export default config
