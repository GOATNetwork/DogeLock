import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'

import { Options } from '@layerzerolabs/lz-v2-utilities'

use(solidity)

describe('Doge Lock Test', function () {
    const ONE_UNIT = ethers.utils.parseEther('1')

    // Constant representing a mock Endpoint ID for testing purposes
    const eidA = 1
    const eidB = 2

    const CONVERSION_MULTIPLIER = 10 ** 10
    // Declaration of variables to be used in the test suite
    let DogeForGoat: ContractFactory
    let GoatOFT: ContractFactory
    let DogecoinMock: ContractFactory
    let EndpointV2Mock: ContractFactory
    let ownerA: SignerWithAddress
    let ownerB: SignerWithAddress
    let endpointOwner: SignerWithAddress

    let dogeForGoat: Contract
    let dogecoin: Contract
    let goatOFT: Contract
    let mockEndpointV2A: Contract
    let mockEndpointV2B: Contract

    // Before hook for setup that runs once before all tests in the block
    before(async function () {
        // Contract factory for our tested contract
        //
        DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')

        GoatOFT = await ethers.getContractFactory('GoatOFT')

        DogecoinMock = await ethers.getContractFactory('DogecoinMock')

        // Fetching the first three signers (accounts) from Hardhat's local Ethereum network
        const signers = await ethers.getSigners()

        ;[ownerA, ownerB, endpointOwner] = signers

        // The EndpointV2Mock contract comes from @layerzerolabs/test-devtools-evm-hardhat package
        // and its artifacts are connected as external artifacts to this project
        //
        // Unfortunately, hardhat itself does not yet provide a way of connecting external artifacts,
        // so we rely on hardhat-deploy to create a ContractFactory for EndpointV2Mock
        //
        // See https://github.com/NomicFoundation/hardhat/issues/1040
        const EndpointV2MockArtifact = await deployments.getArtifact('EndpointV2Mock')
        EndpointV2Mock = new ContractFactory(EndpointV2MockArtifact.abi, EndpointV2MockArtifact.bytecode, endpointOwner)
    })

    // beforeEach hook for setup that runs before each test in the block
    beforeEach(async function () {
        // Deploying a mock LZEndpoint with the given Endpoint ID
        mockEndpointV2A = await EndpointV2Mock.deploy(eidA)
        mockEndpointV2B = await EndpointV2Mock.deploy(eidB)

        dogecoin = await DogecoinMock.deploy('Dogecoin', 'DOG')

        // Deploying two instances of GoatOFT contract with different identifiers and linking them to the mock LZEndpoint
        dogeForGoat = await DogeForGoat.deploy(
            dogecoin.address,
            mockEndpointV2A.address,
            (await ethers.provider.getBlock('latest')).timestamp + 100
        )
        await dogeForGoat.initialize(ownerA.address)
        goatOFT = await GoatOFT.deploy('bOFT', 'bOFT', mockEndpointV2B.address, ownerB.address)

        // Setting destination endpoints in the LZEndpoint mock for each GoatOFT instance
        await mockEndpointV2A.setDestLzEndpoint(goatOFT.address, mockEndpointV2B.address)
        await mockEndpointV2B.setDestLzEndpoint(dogeForGoat.address, mockEndpointV2A.address)

        // Setting each GoatOFT instance as a peer of the other in the mock LZEndpoint
        await dogeForGoat.connect(ownerA).setPeer(eidB, ethers.utils.zeroPad(goatOFT.address, 32))
        await goatOFT.connect(ownerB).setPeer(eidA, ethers.utils.zeroPad(dogeForGoat.address, 32))
    })

    // A test case to verify token transfer functionality
    it('should send a token from A address to B address via OFTAdapter/OFT', async function () {
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const initialAmountLD = ethers.utils.parseUnits('100', 8)
        await dogecoin.mint(ownerA.address, initialAmountLD)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSendLD = ethers.utils.parseUnits('50', 8)
        const tokensToSendSD = ethers.utils.parseUnits('50', 18)

        // Defining extra message execution options for the send operation
        const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

        const sendParam = [
            eidB,
            // ethers.utils.zeroPad(ownerB.address, 32),
            await dogeForGoat.addressToBytes32(ownerB.address),
            tokensToSendSD,
            tokensToSendSD,
            // BigNumber.from(0),
            options,
            '0x',
            '0x',
        ]

        // Fetching the native fee for the token send operation
        const [nativeFee] = await dogeForGoat.quoteSend(sendParam, false)

        // Approving the native fee to be spent by the myOFTA contract
        await dogecoin.connect(ownerA).approve(dogeForGoat.address, tokensToSendLD)
        await dogeForGoat.lock(tokensToSendLD)

        // Executing the send operation from myOFTA contract
        await expect(
            dogeForGoat.bridge(sendParam, [nativeFee, 0], ownerA.address, { value: nativeFee })
        ).to.be.revertedWith('TimeNotReached')
        await time.increase(200)
        await dogeForGoat.bridge(sendParam, [nativeFee, 0], ownerA.address, { value: nativeFee })

        // Fetching the final token balances of ownerA and ownerB
        const finalBalanceA = await dogecoin.balanceOf(ownerA.address)
        const finalBalanceAdapter = await dogecoin.balanceOf(dogeForGoat.address)
        const finalBalanceB = await goatOFT.balanceOf(ownerB.address)

        // Asserting that the final balances are as expected after the send operation
        expect(finalBalanceA).eql(initialAmountLD.sub(tokensToSendLD))
        expect(finalBalanceAdapter).eql(tokensToSendLD)
        expect(finalBalanceB).eql(tokensToSendSD)
    })

    it('test successfully lock/unlock', async function () {
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const initialAmount = ethers.utils.parseUnits('100', 8)
        await dogecoin.mint(ownerA.address, initialAmount)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSend = ethers.utils.parseUnits('50', 8)

        await dogecoin.connect(ownerA).approve(dogeForGoat.address, tokensToSend)
        await dogeForGoat.connect(ownerA).lock(tokensToSend)

        // Fetching the final token balances of ownerA and ownerB
        const finalBalanceA = await dogecoin.balanceOf(ownerA.address)
        const finalBalanceAdapter = await dogecoin.balanceOf(dogeForGoat.address)

        // Asserting that the final balances are as expected after the send operation
        expect(finalBalanceA).eql(initialAmount.sub(tokensToSend))
        expect(finalBalanceAdapter).eql(tokensToSend)

        await dogeForGoat.connect(ownerA).unlock(tokensToSend.mul(CONVERSION_MULTIPLIER))

        expect(await dogecoin.balanceOf(ownerA.address)).eql(initialAmount)
        expect(await dogecoin.balanceOf(dogeForGoat.address)).eql(BigNumber.from(0))
    })

    it('test lock/unlock revert cases', async function () {
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const maxLimit = ethers.utils.parseUnits('5000000', 8)
        const tokensToSend = ethers.utils.parseUnits('50', 8)
        await dogecoin.mint(ownerA.address, maxLimit.mul(3))

        await dogecoin.connect(ownerA).approve(dogeForGoat.address, maxLimit.mul(3))
        // too small
        await expect(dogeForGoat.connect(ownerA).lock(tokensToSend.sub(1))).to.be.revertedWith('BelowMin')
        // too big
        await expect(dogeForGoat.connect(ownerA).lock(maxLimit.add(1))).to.be.revertedWith('ExceededPersonalMax')

        // over total max
        for (let i = 0; i < 4; ++i) {
            const user = await ethers.getImpersonatedSigner(ethers.Wallet.createRandom().address)
            await ownerB.sendTransaction({
                to: user.address,
                value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
            })
            await dogecoin.mint(user.address, maxLimit)
            await dogecoin.connect(user).approve(dogeForGoat.address, maxLimit)
            await dogeForGoat.connect(user).lock(ethers.utils.parseUnits('4500000', 8))
        }
        await expect(dogeForGoat.connect(ownerA).lock(maxLimit)).to.be.revertedWith('ExceededTotalMax')
        // success lock
        await dogeForGoat.connect(ownerA).lock(tokensToSend)

        await expect(
            dogeForGoat.connect(ownerA).unlock(tokensToSend.mul(CONVERSION_MULTIPLIER * 2))
        ).to.be.revertedWith('ExceededBalance')
    })

    it('test owner functions', async function () {
        const initialAmount = ethers.utils.parseUnits('100', 8)
        await dogecoin.mint(ownerA.address, initialAmount)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSend = ethers.utils.parseUnits('50', 8)

        await dogecoin.connect(ownerA).approve(dogeForGoat.address, tokensToSend)
        await dogeForGoat.connect(ownerA).lock(tokensToSend)

        // setMax()
        await expect(dogeForGoat.setMax(tokensToSend.mul(CONVERSION_MULTIPLIER).sub(1))).to.be.revertedWith(
            'InvalidAmount'
        )
        await dogeForGoat.setMax(tokensToSend.mul(CONVERSION_MULTIPLIER))

        // setPersonalLimit()
        await expect(dogeForGoat.setPersonalLimit(ONE_UNIT, ONE_UNIT.mul(2))).to.be.revertedWith('InvalidAmount')
        await dogeForGoat.setPersonalLimit(ONE_UNIT.mul(2), ONE_UNIT)
    })
})
