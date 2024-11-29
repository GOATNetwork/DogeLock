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
        dogeForGoat = await DogeForGoat.deploy(dogecoin.address, mockEndpointV2A.address)
        await dogeForGoat.initialize(ownerA.address)
        goatOFT = await GoatOFT.deploy('Goat OFT', 'GOFT', mockEndpointV2B.address, ownerB.address)

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
        const tokensToSendSD = tokensToSendLD.mul(CONVERSION_MULTIPLIER)

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
        await dogecoin.connect(ownerA).approve(dogeForGoat.address, initialAmountLD)
        await dogeForGoat.deposit(initialAmountLD)

        // Executing the send operation from myOFTA contract
        await dogeForGoat.send(sendParam, [nativeFee, 0], ownerA.address, { value: nativeFee })

        // Fetching the final token balances of ownerA and ownerB
        const finalBalanceA = await dogeForGoat.balanceOf(ownerA.address)
        const finalBalanceB = await goatOFT.balanceOf(ownerB.address)
        const finalBalanceOFT = await dogecoin.balanceOf(dogeForGoat.address)
        let finalBalanceDoge = await dogecoin.balanceOf(ownerA.address)

        // Asserting that the final balances are as expected after the send operation
        expect(finalBalanceA).eql(tokensToSendSD)
        expect(finalBalanceB).eql(tokensToSendSD)
        expect(finalBalanceOFT).eql(initialAmountLD)
        expect(finalBalanceDoge).eql(BigNumber.from(0))

        await dogeForGoat.withdraw(finalBalanceA)

        finalBalanceDoge = await dogecoin.balanceOf(ownerA.address)
        expect(finalBalanceDoge).eql(initialAmountLD.sub(tokensToSendLD))
    })

    it('should recover', async function () {
        const initialAmount = ethers.utils.parseUnits('2', 8)
        await dogecoin.mint(ownerA.address, initialAmount)

        await dogecoin.approve(dogeForGoat.address, initialAmount)
        await dogeForGoat.deposit(initialAmount)
        let dogeBalance = await dogecoin.balanceOf(ownerA.address)
        let dfgDogeBalance = await dogecoin.balanceOf(dogeForGoat.address)
        let totalSupply = await dogeForGoat.totalSupply()
        expect(dogeBalance).eql(BigNumber.from(0))
        expect(dfgDogeBalance).eql(initialAmount)
        expect(totalSupply).eql(initialAmount.mul(CONVERSION_MULTIPLIER))

        await dogeForGoat.withdraw(totalSupply.sub(1))
        dogeBalance = await dogecoin.balanceOf(ownerA.address)
        dfgDogeBalance = await dogecoin.balanceOf(dogeForGoat.address)
        totalSupply = await dogeForGoat.totalSupply()
        expect(dogeBalance).eql(initialAmount.sub(1))
        expect(dfgDogeBalance).eql(BigNumber.from(1))
        expect(totalSupply).eql(BigNumber.from(1))

        await dogecoin.approve(dogeForGoat.address, initialAmount)
        await dogeForGoat.deposit(initialAmount.sub(1))
        dogeBalance = await dogecoin.balanceOf(ownerA.address)
        dfgDogeBalance = await dogecoin.balanceOf(dogeForGoat.address)
        totalSupply = await dogeForGoat.totalSupply()
        expect(dogeBalance).eql(BigNumber.from(0))
        expect(dfgDogeBalance).eql(initialAmount)
        expect(totalSupply).eql(initialAmount.sub(1).mul(CONVERSION_MULTIPLIER).add(1))

        await dogeForGoat.recover(ownerB.address)
        expect(await dogeForGoat.balanceOf(ownerB.address)).eql(ethers.utils.parseUnits('1', 10).sub(1))
    })
})
