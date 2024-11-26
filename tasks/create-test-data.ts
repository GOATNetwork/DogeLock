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

    console.log('Test data creation completed!')
})
