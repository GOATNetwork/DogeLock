import { existsSync } from 'fs'
import { join } from 'path'

import { utils } from 'ethers'
import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment, Network } from 'hardhat/types'

import { Options } from '@layerzerolabs/lz-v2-utilities'

import type { Log } from '@ethersproject/abstract-provider'

// npx hardhat user-lock --amount 50 --network testnet
// npx hardhat user-unlock --amount 50 --network testnet
// npx hardhat user-bridge --amount 50 --network testnet

// Helper function to get contract instances
async function getContracts(network: Network, hre: HardhatRuntimeEnvironment) {
    const deploymentPath = join(__dirname, `../subgraph/${network.name}.json`)
    if (!existsSync(deploymentPath)) {
        throw new Error(`${network.name}.json not found`)
    }

    const { DogeLock: dogeLockAddress, Token: tokenAddress, DogeForGoat: dogeForGoatAddress } = require(deploymentPath)
    if (!dogeLockAddress || !tokenAddress || !dogeForGoatAddress) {
        throw new Error(`Contract addresses not found in ${network.name}.json`)
    }
    console.log('dogeLockAddress', dogeLockAddress)
    console.log('tokenAddress', tokenAddress)
    console.log('dogeForGoatAddress', dogeForGoatAddress)

    return {
        dogeLock: await hre.ethers.getContractAt('DogeLockUpgradeable', dogeLockAddress),
        token: await hre.ethers.getContractAt('DogecoinMock', tokenAddress),
        dogeForGoat: await hre.ethers.getContractAt('DogeForGoatUpgradeable', dogeForGoatAddress),
        dogeLockAddress,
        dogeForGoatAddress,
    }
}

// Helper function to check if network is supported
function checkNetwork(network: string) {
    const supportedNetworks = ['testnet', 'localhost', 'dev']
    if (!supportedNetworks.includes(network)) {
        throw new Error(`This task is only supported on: ${supportedNetworks.join(', ')}`)
    }
}

// Task for locking tokens
task('user-lock', 'Lock tokens on testnet')
    .addParam('amount', 'Amount of tokens to lock')
    .setAction(async ({ amount }, hre) => {
        const { ethers, network } = hre

        try {
            checkNetwork(network.name)

            const [signer] = await ethers.getSigners()
            console.log('Locking tokens with address:', await signer.getAddress())

            const { dogeLock, token, dogeLockAddress } = await getContracts(network, hre)
            const amountWithDecimals = utils.parseUnits(amount, 8)

            console.log(`\nLocking ${amount} tokens...`)

            // Approve tokens
            console.log(`Approving ${amount} tokens`)
            await token.approve(dogeLockAddress, amountWithDecimals, {
                gasLimit: 500000,
            })

            // Lock tokens
            console.log(`Locking ${amount} tokens`)
            const tx = await dogeLock.lock(amountWithDecimals, {
                gasLimit: 500000,
            })

            // 添加这些日志
            const receipt = await tx.wait()
            console.log('Transaction receipt:', receipt.hash)
            const events = receipt.logs
                .map((log: Log) => {
                    try {
                        return dogeLock.interface.parseLog(log)
                    } catch (e) {
                        return null
                    }
                })
                .filter(Boolean)
            console.log('Events emitted:', events)

            console.log('Lock operation completed!')
        } catch (error: unknown) {
            console.error(error)
        }
    })

// Task for unlocking tokens
task('user-unlock', 'Unlock tokens on testnet')
    .addParam('amount', 'Amount of tokens to unlock')
    .setAction(async ({ amount }, hre) => {
        const { ethers, network } = hre

        try {
            checkNetwork(network.name)

            const [signer] = await ethers.getSigners()
            console.log('Unlocking tokens with address:', await signer.getAddress())

            const { dogeLock } = await getContracts(network, hre)
            const amountWithDecimals = utils.parseUnits(amount, 8)

            console.log(`\nUnlocking ${amount} tokens...`)
            const tx = await dogeLock.unlock(amountWithDecimals, {
                gasLimit: 1000000,
            })
            const receipt = await tx.wait()
            console.log('Transaction receipt:', receipt.hash)
            const events = receipt.logs
                .map((log: Log) => {
                    try {
                        return dogeLock.interface.parseLog(log)
                    } catch (e) {
                        return null
                    }
                })
                .filter(Boolean)
            console.log('Events emitted:', events)

            console.log('Unlock operation completed!')
        } catch (error: unknown) {
            console.error(error)
        }
    })

// Task for bridging tokens
task('user-bridge', 'Bridge tokens on testnet')
    .addParam('amount', 'Amount of tokens to bridge')
    .setAction(async ({ amount }, hre) => {
        const { ethers, network } = hre

        try {
            checkNetwork(network.name)

            const [signer] = await ethers.getSigners()
            const address = await signer.getAddress()
            console.log('Bridging tokens with address:', address)

            const { dogeLock, token, dogeLockAddress, dogeForGoat } = await getContracts(network, hre)
            const bridgeAmount = utils.parseUnits(amount, 8)

            try {
                // 设置跨链参数
                const extraOptions = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()
                const sendParam = [
                    2, // destination chain eid
                    ethers.utils.zeroPad(address, 32),
                    bridgeAmount.mul(10 ** 10), // convert to 18 decimals
                    bridgeAmount
                        .mul(10 ** 10)
                        .mul(95)
                        .div(100), // minAmount (95%)
                    extraOptions,
                    '0x',
                    '0x',
                ]

                // 获取费用报价
                console.log('Getting quote for fees...')
                const [nativeFee] = await dogeForGoat.quoteSend(sendParam, false)
                console.log('Quote received:', {
                    nativeFee: nativeFee.toString(),
                })

                // 授权 DogeLock 合约
                console.log('Approving tokens for bridge...')
                await token.approve(dogeLockAddress, bridgeAmount, {
                    gasLimit: 500000,
                })

                // 执行跨链
                console.log('Executing bridge transaction...')
                const tx = await dogeLock.bridge(dogeForGoat.address, bridgeAmount, sendParam, [nativeFee, 0], {
                    value: nativeFee,
                    gasLimit: 1000000,
                })

                const receipt = await tx.wait()
                console.log('Transaction receipt:', receipt.hash)
                const events = receipt.logs
                    .map((log: Log) => {
                        try {
                            return dogeLock.interface.parseLog(log)
                        } catch (e) {
                            return null
                        }
                    })
                    .filter(Boolean)
                console.log('Events emitted:', events)

                console.log('Bridge operation completed!')
            } catch (error) {
                console.error('Error during bridge operation:', error)
            }
        } catch (error: unknown) {
            console.error(error)
        }
    })

// 添加新的任务用于设置全局最大限额
task('set-max-limit', 'Set max total lock limit')
    .addParam('amount', 'Amount of max total lock limit in DOGE')
    .setAction(async ({ amount }, hre) => {
        const { ethers, network } = hre

        try {
            checkNetwork(network.name)

            const [signer] = await ethers.getSigners()
            console.log('Setting max limit with address:', await signer.getAddress())

            const { dogeLock } = await getContracts(network, hre)
            const amountWithDecimals = utils.parseUnits(amount, 8)

            console.log(`\nSetting max total lock limit to ${amount} DOGE...`)
            await dogeLock.setMax(amountWithDecimals, {
                gasLimit: 500000,
            })

            console.log('Max limit set successfully!')
        } catch (error: unknown) {
            console.error(error)
        }
    })

// 添加新的任务用于设置个人限额
task('set-personal-limits', 'Set personal min/max lock limits')
    .addParam('max', 'Max amount in DOGE for personal lock limit')
    .addParam('min', 'Min amount in DOGE for personal lock limit')
    .setAction(async ({ max, min }, hre) => {
        const { ethers, network } = hre

        try {
            checkNetwork(network.name)

            const [signer] = await ethers.getSigners()
            console.log('Setting personal limits with address:', await signer.getAddress())

            const { dogeLock } = await getContracts(network, hre)

            const maxAmount = utils.parseUnits(max, 8)
            const minAmount = utils.parseUnits(min, 8)

            console.log(`\nSetting personal limits...`)
            console.log(`Max: ${max} DOGE`)
            console.log(`Min: ${min} DOGE`)

            await dogeLock.setPersonalLimit(maxAmount, minAmount, {
                gasLimit: 500000,
            })

            console.log('Personal limits set successfully!')
        } catch (error: unknown) {
            console.error(error)
        }
    })

// Task for setting peer
task('set-peer', 'Set peer for DogeForGoat')
    .addParam('eid', 'Destination chain eid')
    .addParam('peer', 'Peer address on destination chain')
    .setAction(async ({ eid, peer }, hre) => {
        const { ethers, network } = hre

        try {
            checkNetwork(network.name)

            const [signer] = await ethers.getSigners()
            console.log('Setting peer with address:', await signer.getAddress())

            const { dogeForGoat } = await getContracts(network, hre)

            console.log(`\nSetting peer...`)
            console.log(`EID: ${eid}`)
            console.log(`Peer: ${peer}`)

            await dogeForGoat.setPeer(eid, ethers.utils.zeroPad(peer, 32), {
                gasLimit: 500000,
            })

            console.log('Peer set successfully!')
        } catch (error: unknown) {
            console.error(error)
        }
    })
