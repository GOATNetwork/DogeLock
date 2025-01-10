import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, ContractFactory, Wallet } from 'ethers'
import { ethers } from 'hardhat'

use(solidity)

describe('Doge Lock Test', function () {
    const ONE_UNIT = ethers.utils.parseUnits('1', 8)

    // Constant representing a mock Endpoint ID for testing purposes
    const eidA = 1
    const eidB = 2
    // Declaration of variables to be used in the test suite
    let DogeLock: ContractFactory
    let DogecoinMock: ContractFactory
    let ownerA: SignerWithAddress
    let ownerB: SignerWithAddress

    let dogeLock: Contract
    let dogecoin: Contract

    // Before hook for setup that runs once before all tests in the block
    before(async function () {
        // Contract factory for our tested contract
        DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')

        DogecoinMock = await ethers.getContractFactory('DogecoinMock')

        // Fetching the first three signers (accounts) from Hardhat's local Ethereum network
        const signers = await ethers.getSigners()

        ;[ownerA, ownerB] = signers
    })

    // beforeEach hook for setup that runs before each test in the block
    beforeEach(async function () {
        dogecoin = await DogecoinMock.deploy()
        // arbitrary non-zero address for adapter
        const adaptAddress = Wallet.createRandom().address

        dogeLock = await DogeLock.deploy(dogecoin.address, adaptAddress)
        await dogeLock.initialize(ownerA.address)
    })

    it('test successfully lock/unlock', async function () {
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const initialAmount = (await dogeLock.personalMinLockAmount()).mul(2)
        await dogecoin.mint(ownerA.address, initialAmount)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSend = await dogeLock.personalMinLockAmount()

        await dogecoin.connect(ownerA).approve(dogeLock.address, tokensToSend)
        await dogeLock.connect(ownerA).lock(tokensToSend)

        // Fetching the final token balances of ownerA and ownerB
        const finalBalanceA = await dogecoin.balanceOf(ownerA.address)
        const finalBalanceAdapter = await dogecoin.balanceOf(dogeLock.address)

        // Asserting that the final balances are as expected after the send operation
        expect(finalBalanceA).eql(initialAmount.sub(tokensToSend))
        expect(finalBalanceAdapter).eql(tokensToSend)

        await dogeLock.connect(ownerA).unlock(tokensToSend)

        expect(await dogecoin.balanceOf(ownerA.address)).eql(initialAmount)
        expect(await dogecoin.balanceOf(dogeLock.address)).eql(BigNumber.from(0))
    })

    it('test lock/unlock revert cases', async function () {
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const maxLimit = await dogeLock.personalMaxLockAmount()
        const minLimit = await dogeLock.personalMinLockAmount()
        await dogecoin.mint(ownerA.address, maxLimit.mul(3))

        await dogecoin.connect(ownerA).approve(dogeLock.address, maxLimit.mul(3))
        // too small
        await expect(dogeLock.connect(ownerA).lock(minLimit.sub(1))).to.be.revertedWith('BelowMin')
        // too big
        await expect(dogeLock.connect(ownerA).lock(maxLimit.add(1))).to.be.revertedWith('ExceededPersonalMax')
        // over total max
        for (let i = 0; i < 40; ++i) {
            const user = await ethers.getImpersonatedSigner(ethers.Wallet.createRandom().address)
            await ownerB.sendTransaction({
                to: user.address,
                value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
            })
            await dogecoin.mint(user.address, maxLimit)
            await dogecoin.connect(user).approve(dogeLock.address, maxLimit)
            await dogeLock.connect(user).lock(maxLimit)
        }
        await dogeLock.setMax((await dogeLock.totalBalance()).add(minLimit))
        await expect(dogeLock.connect(ownerA).lock(maxLimit)).to.be.revertedWith('ExceededTotalMax')
        // success lock
        await dogeLock.connect(ownerA).lock(minLimit)
        await expect(dogeLock.connect(ownerA).unlock(minLimit.add(1))).to.be.revertedWith('ExceededBalance')
    })

    it('test owner functions', async function () {
        const initialAmount = ethers.utils.parseUnits('100', 8)
        await dogecoin.mint(ownerA.address, initialAmount)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSend = ethers.utils.parseUnits('50', 8)

        await dogecoin.connect(ownerA).approve(dogeLock.address, tokensToSend)
        await dogeLock.connect(ownerA).lock(tokensToSend)

        // setMax()
        await expect(dogeLock.setMax(tokensToSend.sub(1))).to.be.revertedWith('InvalidAmount')
        await dogeLock.setMax(tokensToSend)

        // setPersonalLimit()
        await expect(dogeLock.setPersonalLimit(ONE_UNIT, ONE_UNIT.mul(2))).to.be.revertedWith('InvalidAmount')
        await dogeLock.setPersonalLimit(ONE_UNIT.mul(2), ONE_UNIT)
    })
})
