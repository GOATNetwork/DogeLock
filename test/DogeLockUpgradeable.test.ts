import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

import { Options } from '@layerzerolabs/lz-v2-utilities'

describe('Doge Lock Test', function () {
    // Constant representing a mock Endpoint ID for testing purposes
    const eidA = 1
    const eidB = 2
    // Declaration of variables to be used in the test suite
    let DogeLock: ContractFactory
    let MyOFT: ContractFactory
    let ERC20Mock: ContractFactory
    let EndpointV2Mock: ContractFactory
    let ownerA: SignerWithAddress
    let ownerB: SignerWithAddress
    let endpointOwner: SignerWithAddress

    let dogeLock: Contract
    let token: Contract
    let myOFTB: Contract
    let mockEndpointV2A: Contract
    let mockEndpointV2B: Contract

    // Before hook for setup that runs once before all tests in the block
    before(async function () {
        // Contract factory for our tested contract
        //
        DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')

        MyOFT = await ethers.getContractFactory('MyOFTMock')

        ERC20Mock = await ethers.getContractFactory('DogecoinMock')

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

        token = await ERC20Mock.deploy('Token', 'TOKEN')

        // Deploying two instances of MyOFT contract with different identifiers and linking them to the mock LZEndpoint
        dogeLock = await DogeLock.deploy(token.address, mockEndpointV2A.address, BigNumber.from(0))
        await dogeLock.initialize(ownerA.address)
        myOFTB = await MyOFT.deploy('bOFT', 'bOFT', mockEndpointV2B.address, ownerB.address)

        // Setting destination endpoints in the LZEndpoint mock for each MyOFT instance
        await mockEndpointV2A.setDestLzEndpoint(myOFTB.address, mockEndpointV2B.address)
        await mockEndpointV2B.setDestLzEndpoint(dogeLock.address, mockEndpointV2A.address)

        // Setting each MyOFT instance as a peer of the other in the mock LZEndpoint
        await dogeLock.connect(ownerA).setPeer(eidB, ethers.utils.zeroPad(myOFTB.address, 32))
        await myOFTB.connect(ownerB).setPeer(eidA, ethers.utils.zeroPad(dogeLock.address, 32))
    })

    it('test successfully lock/unlock', async function () {
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const initialAmount = ethers.utils.parseUnits('100', 8)
        await token.mint(ownerA.address, initialAmount)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSend = ethers.utils.parseUnits('50', 8)

        await token.connect(ownerA).approve(dogeLock.address, tokensToSend)
        await dogeLock.connect(ownerA).lock(tokensToSend)

        // Fetching the final token balances of ownerA and ownerB
        const finalBalanceA = await token.balanceOf(ownerA.address)
        const finalBalanceAdapter = await token.balanceOf(dogeLock.address)

        // Asserting that the final balances are as expected after the send operation
        expect(finalBalanceA).eql(initialAmount.sub(tokensToSend))
        expect(finalBalanceAdapter).eql(tokensToSend)

        await dogeLock.connect(ownerA).unlock(tokensToSend)

        expect(await token.balanceOf(ownerA.address)).eql(initialAmount)
        expect(await token.balanceOf(dogeLock.address)).eql(BigNumber.from(0))
    })

    // A test case to verify token transfer functionality
    it('should send a token from A address to B address via OFTAdapter/OFT', async function () {
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const initialAmount = ethers.utils.parseUnits('100', 8)
        await token.mint(ownerA.address, initialAmount)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSend = ethers.utils.parseUnits('50', 8)

        // Defining extra message execution options for the send operation
        const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

        const sendParam = [
            eidB,
            ethers.utils.zeroPad(ownerB.address, 32),
            tokensToSend,
            tokensToSend,
            // BigNumber.from(0),
            options,
            '0x',
            '0x',
        ]

        // Fetching the native fee for the token send operation
        const [nativeFee] = await dogeLock.quoteSend(sendParam, false)

        // Approving the native fee to be spent by the myOFTA contract
        await token.connect(ownerA).approve(dogeLock.address, tokensToSend)
        await dogeLock.lock(tokensToSend)

        // Executing the send operation from myOFTA contract
        await dogeLock.bridge(sendParam, [nativeFee, 0], ownerA.address, { value: nativeFee })

        // Fetching the final token balances of ownerA and ownerB
        const finalBalanceA = await token.balanceOf(ownerA.address)
        const finalBalanceAdapter = await token.balanceOf(dogeLock.address)
        const finalBalanceB = await myOFTB.balanceOf(ownerB.address)

        // Asserting that the final balances are as expected after the send operation
        expect(finalBalanceA).eql(initialAmount.sub(tokensToSend))
        expect(finalBalanceAdapter).eql(tokensToSend)
        expect(finalBalanceB).eql(tokensToSend)
    })
})
