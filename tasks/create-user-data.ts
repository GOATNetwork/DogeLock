import { existsSync } from 'fs'
import { join } from 'path'

import { utils } from 'ethers'
import { task } from 'hardhat/config'

import { Options } from '@layerzerolabs/lz-v2-utilities'

task('create-user-data', 'Create user data for testnet operations').setAction(async (_, { ethers, network }) => {
    if (network.name !== 'testnet') {
        console.error('This task is only for testnet network')
        return
    }

    // Get signer
    const [signer] = await ethers.getSigners()
    const address = await signer.getAddress()
    console.log('Creating data with address:', address)

    // Get contract instances
    const deploymentPath = join(__dirname, `../subgraph/${network.name}.json`)
    if (!existsSync(deploymentPath)) {
        throw new Error(`${network.name}.json not found`)
    }

    const { DogeLock: dogeLockAddress, Token: tokenAddress } = require(deploymentPath)
    if (!dogeLockAddress || !tokenAddress) {
        throw new Error(`Contract addresses not found in ${network.name}.json`)
    }

    console.log('Using DogeLock at:', dogeLockAddress)
    const dogeLock = await ethers.getContractAt('DogeLockUpgradeable', dogeLockAddress)
    const token = await ethers.getContractAt('DogecoinMock', tokenAddress)

    // Lock operations
    const lockAmounts = ['50', '100']
    for (const amount of lockAmounts) {
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
    }

    // Unlock operation
    const unlockAmount = utils.parseUnits('50', 8)
    console.log(`\nUnlocking 50 tokens...`)
    await dogeLock.unlock(unlockAmount, {
        gasLimit: 1000000,
    })

    // Bridge operation
    const bridgeAmount = utils.parseUnits('50', 8)
    console.log(`\nBridging 50 tokens...`)

    try {
        const extraOptions = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

        const sendParam = {
            dstEid: 2, // Destination chain ID
            to: ethers.utils.zeroPad(address, 32),
            amountLD: bridgeAmount,
            minAmountLD: bridgeAmount.mul(95).div(100), // 5% slippage
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

        // Approve tokens for bridge if needed
        await token.approve(dogeLockAddress, bridgeAmount, {
            gasLimit: 500000,
        })

        // Execute bridge
        const tx = await dogeLock.bridge(sendParam, quote, address, { value: quote.nativeFee, gasLimit: 1000000 })
        await tx.wait()

        console.log('Successfully bridged 50 tokens')
    } catch (error) {
        console.error('Error during bridge operation:', error)
    }

    console.log('\nAll operations completed!')
})
