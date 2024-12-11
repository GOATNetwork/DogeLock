// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import 'dotenv/config'

import 'hardhat-deploy'
import 'solidity-coverage'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@nomicfoundation/hardhat-verify'
import '@layerzerolabs/toolbox-hardhat'
import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

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
            endpoint: '0x6EDCE65403992e310A62460808c4b910D972f10f',
            configOption: {
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
        'goat-testnet': {
            url: process.env.RPC_URL_GOAT_TESTNET,
            accounts,
            endpoint: '0x6C7Ab2202C98C4227C5c46f1417D81144DA716Ff',
        },
        'bsc-testnet': {
            eid: EndpointId.BSC_V2_TESTNET,
            url: process.env.RPC_URL_BSC_TESTNET || 'https://bsc-testnet-rpc.publicnode.com',
            accounts,
            endpoint: '0x6EDCE65403992e310A62460808c4b910D972f10f',
        },
        'bsc-mainnet': {
            eid: EndpointId.BSC_V2_MAINNET,
            url: process.env.RPC_URL_BSC_MAINNET,
            accounts,
            endpoint: '0x1a44076050125825900e736c501f859c50fE728c',
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
    },
    sourcify: {
        enabled: true,
    },
    etherscan: {
        apiKey: process.env.API_KEY,
        customChains: [
            {
                network: 'goat-testnet',
                chainId: 48816,
                urls: {
                    apiURL: 'https://explorer.testnet3.goat.network/api',
                    browserURL: 'https://explorer.testnet3.goat.network',
                },
            },
        ],
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
