import { existsSync } from 'fs'
import { join } from 'path'

import { utils } from 'ethers'
import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment, Network } from 'hardhat/types'

import { Options } from '@layerzerolabs/lz-v2-utilities'

// npx hardhat user-lock --amount 50 --network testnet
// npx hardhat user-unlock --amount 50 --network testnet
// npx hardhat user-bridge --amount 50 --network testnet

// Helper function to get contract instances
async function getContracts(network: Network, hre: HardhatRuntimeEnvironment) {
    const deploymentPath = join(__dirname, `../subgraph/${network.name}.json`)
    if (!existsSync(deploymentPath)) {
        throw new Error(`${network.name}.json not found`)
    }

    const { DogeLock: dogeLockAddress, Token: tokenAddress } = require(deploymentPath)
    if (!dogeLockAddress || !tokenAddress) {
        throw new Error(`Contract addresses not found in ${network.name}.json`)
    }

    return {
        dogeLock: await hre.ethers.getContractAt('DogeLockUpgradeable', dogeLockAddress),
        token: await hre.ethers.getContractAt('DogecoinMock', tokenAddress),
        dogeLockAddress,
    }
}

// Task for locking tokens
task('user-lock', 'Lock tokens on testnet')
    .addParam('amount', 'Amount of tokens to lock')
    .setAction(async ({ amount }, hre) => {
        const { ethers, network } = hre

        if (network.name !== 'testnet') {
            console.error('This task is only for testnet network')
            return
        }

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
        await dogeLock.lock(amountWithDecimals, {
            gasLimit: 500000,
        })

        console.log('Lock operation completed!')
    })

// Task for unlocking tokens
task('user-unlock', 'Unlock tokens on testnet')
    .addParam('amount', 'Amount of tokens to unlock')
    .setAction(async ({ amount }, hre) => {
        const { ethers, network } = hre

        if (network.name !== 'testnet') {
            console.error('This task is only for testnet network')
            return
        }

        const [signer] = await ethers.getSigners()
        console.log('Unlocking tokens with address:', await signer.getAddress())

        const { dogeLock } = await getContracts(network, hre)
        const amountWithDecimals = utils.parseUnits(amount, 8)

        console.log(`\nUnlocking ${amount} tokens...`)
        await dogeLock.unlock(amountWithDecimals, {
            gasLimit: 1000000,
        })

        console.log('Unlock operation completed!')
    })

// Task for bridging tokens
task('user-bridge', 'Bridge tokens on testnet')
    .addParam('amount', 'Amount of tokens to bridge')
    .setAction(async ({ amount }, hre) => {
        const { ethers, network } = hre

        if (network.name !== 'testnet') {
            console.error('This task is only for testnet network')
            return
        }

        const [signer] = await ethers.getSigners()
        const address = await signer.getAddress()
        console.log('Bridging tokens with address:', address)

        const { dogeLock, token, dogeLockAddress } = await getContracts(network, hre)
        const bridgeAmount = utils.parseUnits(amount, 8)

        try {
            const extraOptions = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

            const sendParam = {
                dstEid: 2,
                to: ethers.utils.zeroPad(address, 32),
                amountLD: bridgeAmount,
                minAmountLD: bridgeAmount.mul(95).div(100),
                extraOptions,
                composeMsg: '0x',
                oftCmd: '0x',
            }

            console.log('Getting quote for fees...')
            const quote = await dogeLock.quoteSend(sendParam, false)
            console.log('Quote received:', {
                nativeFee: quote.nativeFee.toString(),
                lzTokenFee: quote.lzTokenFee.toString(),
            })

            // Approve tokens for bridge
            await token.approve(dogeLockAddress, bridgeAmount, {
                gasLimit: 500000,
            })

            // Execute bridge
            const tx = await dogeLock.bridge(sendParam, quote, address, { value: quote.nativeFee, gasLimit: 1000000 })
            await tx.wait()

            console.log('Bridge operation completed!')
        } catch (error) {
            console.error('Error during bridge operation:', error)
        }
    })
