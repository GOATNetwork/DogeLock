import { existsSync } from 'fs'
import { join } from 'path'

import { utils } from 'ethers'
import { task } from 'hardhat/config'

task('create-test-data', 'Create test data for local development').setAction(async (_, { ethers, network }) => {
    if (network.name !== 'localhost' && network.name !== 'dev') {
        console.error('This task is only for localhost or dev network')
        return
    }

    // Get signers
    const signers = await ethers.getSigners()
    const [owner, user1, user2, user3] = signers
    console.log('Creating test data with owner:', await owner.getAddress())

    // Get contract instance
    const localnetPath = join(__dirname, '../subgraph/localnet.json')
    if (!existsSync(localnetPath)) {
        throw new Error('localnet.json not found. Please deploy contracts first')
    }

    const { DogeLock: dogeLockAddress, Token: tokenAddress } = require(localnetPath)
    if (!dogeLockAddress || !tokenAddress) {
        throw new Error('Contract addresses not found in localnet.json')
    }

    console.log('Using DogeLock at:', dogeLockAddress)
    const dogeLock = await ethers.getContractAt('DogeLockUpgradeable', dogeLockAddress)
    const token = await ethers.getContractAt('DogecoinMock', tokenAddress)

    // Create test data
    const createTestData = async (user: (typeof signers)[0], amounts: string[]) => {
        const address = await user.getAddress()
        console.log(`Creating data for user ${address}`)
        for (const amount of amounts) {
            const amountWithDecimals = utils.parseUnits(amount, 8)

            // First mint tokens to user
            console.log(`Minting ${amount} tokens to user`)
            await token.connect(owner).mint(address, amountWithDecimals, {
                gasLimit: 500000,
            })

            // Then approve tokens
            console.log(`Approving ${amount} tokens`)
            await token.connect(user).approve(dogeLockAddress, amountWithDecimals, {
                gasLimit: 500000,
            })

            // Finally lock tokens
            console.log(`Locking ${amount} tokens (${amountWithDecimals.toString()} base units)`)
            await dogeLock.connect(user).lock(amountWithDecimals, {
                gasLimit: 500000,
            })

            // If amount is greater than 100, unlock half
            if (Number(amount) > 100) {
                const unlockAmount = amountWithDecimals.div(2)
                console.log(`Unlocking ${unlockAmount.toString()} tokens`)
                await dogeLock.connect(user).unlock(unlockAmount, {
                    gasLimit: 1000000,
                })
            }
        }
    }

    // Create different test data for each user (amounts in DOGE)
    const testData = [
        // user1: Multiple small operations
        ['50', '100', '150'],
        // user2: Few large operations
        ['1000', '2000'],
        // user3: Mixed operations
        ['50', '500', '150'],
    ]

    // Execute test data creation
    await createTestData(user1, testData[0])
    await createTestData(user2, testData[1])
    await createTestData(user3, testData[2])

    // Create bridge test data
    const createBridgeTestData = async (user: (typeof signers)[0], bridgeAmounts: string[]) => {
        const address = await user.getAddress()
        console.log(`Creating bridge data for user ${address}`)

        for (const amount of bridgeAmounts) {
            const amountWithDecimals = utils.parseUnits(amount, 8)

            // First mint and approve tokens if needed
            console.log(`Minting ${amount} tokens to user for bridging`)
            await token.connect(owner).mint(address, amountWithDecimals, {
                gasLimit: 500000,
            })
            await token.connect(user).approve(dogeLockAddress, amountWithDecimals, {
                gasLimit: 500000,
            })

            // Simulate bridge send (to chain ID 2)
            console.log(`Sending ${amount} tokens through bridge`)
            const dstEid = 2 // Example destination chain ID
            const minAmount = amountWithDecimals.mul(80).div(100) // 降低最小接收金额到 80%
            const extraOptions = '0x'
            const composeMsg = '0x'
            const oftCmd = '0x'

            // Create send params
            const sendParam = {
                dstEid: dstEid,
                to: utils.hexZeroPad(address, 32),
                amountLD: amountWithDecimals,
                minAmountLD: minAmount,
                extraOptions,
                composeMsg,
                oftCmd,
            }

            // Get quote for fees
            try {
                console.log('Getting quote for fees...')
                console.log('Send params:', {
                    dstEid: sendParam.dstEid,
                    amountLD: sendParam.amountLD.toString(),
                    minAmountLD: sendParam.minAmountLD.toString(),
                })

                const quote = await dogeLock.quoteSend(sendParam, false) // 第二个参数改为 false
                console.log('Quote received:', {
                    nativeFee: quote.nativeFee.toString(),
                    lzTokenFee: quote.lzTokenFee.toString(),
                })

                // Execute bridge send
                console.log('Executing bridge send...')
                await dogeLock.connect(user).send(sendParam, { value: quote.nativeFee }, address, {
                    gasLimit: 1000000,
                })

                console.log(`Successfully sent ${amount} tokens through bridge`)
            } catch (error) {
                console.error('Error during bridge operation:', error)
                continue
            }
        }
    }

    // Bridge test data (amounts in DOGE)
    const bridgeTestData = [
        ['25', '75'], // user1: Small bridge transfers
        ['500'], // user2: Large bridge transfer
        ['50', '200'], // user3: Mixed bridge transfers
    ]

    // Execute bridge test data creation
    console.log('Creating bridge test data...')
    await createBridgeTestData(user1, bridgeTestData[0])
    await createBridgeTestData(user2, bridgeTestData[1])
    await createBridgeTestData(user3, bridgeTestData[2])

    console.log('All test data creation completed!')
})
