import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

import { Options } from '@layerzerolabs/lz-v2-utilities'

use(solidity)

describe('Doge Adapter Test', function () {
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
        DogeForGoat = await ethers.getContractFactory('AdapterUpgradeable')

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

        dogecoin = await DogecoinMock.deploy()

        // Deploying two instances of GoatOFT contract with different identifiers and linking them to the mock LZEndpoint
        dogeForGoat = await DogeForGoat.deploy(dogecoin.address, mockEndpointV2A.address)
        await dogeForGoat.initialize(ownerA.address)
        goatOFT = await GoatOFT.deploy('Goat OFT', 'GOFT', mockEndpointV2B.address, ownerB.address)

        // Setting destination endpoints in the LZEndpoint mock for each GoatOFT instance
        await mockEndpointV2A.setDestLzEndpoint(goatOFT.address, mockEndpointV2B.address)
        await mockEndpointV2B.setDestLzEndpoint(dogeForGoat.address, mockEndpointV2A.address)

        // set configs
        const options = Options.newOptions().addExecutorLzReceiveOption(60000, 0).toHex().toString()
        const enforcedOptionParamA = [
            eidB, // destination endpoint eid
            1, // SEND message type
            options,
        ]
        const enforcedOptionParamB = [
            eidA, // destination endpoint eid
            1, // SEND message type
            options,
        ]
        await dogeForGoat.connect(ownerA).setEnforcedOptions([enforcedOptionParamA])
        await goatOFT.connect(ownerB).setEnforcedOptions([enforcedOptionParamB])

        // Setting each GoatOFT instance as a peer of the other in the mock LZEndpoint
        await dogeForGoat.connect(ownerA).setPeer(eidB, ethers.utils.zeroPad(goatOFT.address, 32))
        await goatOFT.connect(ownerB).setPeer(eidA, ethers.utils.zeroPad(dogeForGoat.address, 32))
    })

    // A test case to verify token transfer functionality
    it('bridge from A to B and back to A', async function () {
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const initialAmountLD = ethers.utils.parseUnits('100', 8)
        await dogecoin.mint(ownerA.address, initialAmountLD)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSendLD = ethers.utils.parseUnits('60', 8)
        const tokensToSendSD = tokensToSendLD.mul(CONVERSION_MULTIPLIER)

        let sendParam = [
            eidB,
            await dogeForGoat.addressToBytes32(ownerB.address),
            tokensToSendLD,
            tokensToSendLD,
            '0x',
            '0x',
            '0x',
        ]

        // Fetching the native fee for the token send operation
        const [nativeFee] = await dogeForGoat.quoteSend(sendParam, false)

        // Approving the native fee to be spent by the myOFTA contract
        await dogecoin.connect(ownerA).approve(dogeForGoat.address, initialAmountLD)

        // Executing the send operation from myOFTA contract
        await dogeForGoat.send(sendParam, [nativeFee, 0], ownerA.address, { value: nativeFee })

        // Fetching the final token balances of ownerA and ownerB
        let finalBalanceA = await dogecoin.balanceOf(ownerA.address)
        let finalBalanceB = await goatOFT.balanceOf(ownerB.address)
        const finalBalanceOFT = await dogecoin.balanceOf(dogeForGoat.address)

        // Asserting that the final balances are as expected after the send operation
        expect(finalBalanceA).eql(initialAmountLD.sub(tokensToSendLD))
        expect(finalBalanceB).eql(tokensToSendSD)
        expect(finalBalanceOFT).eql(tokensToSendLD)

        // bridge back
        sendParam = [eidA, ethers.utils.zeroPad(ownerA.address, 32), tokensToSendSD, tokensToSendSD, '0x', '0x', '0x']
        const [nativeFee2] = await goatOFT.quoteSend(sendParam, false)
        await goatOFT.connect(ownerB).send(sendParam, [nativeFee2, 0], ownerB.address, { value: nativeFee2 })

        finalBalanceA = await dogecoin.balanceOf(ownerA.address)
        finalBalanceB = await goatOFT.balanceOf(ownerB.address)

        expect(finalBalanceA).eql(initialAmountLD)
        expect(finalBalanceB).eql(BigNumber.from(0))
    })

    // A test case to verify token transfer functionality
    it('should send locked token from DogeLock', async function () {
        const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')
        const dogeLock = await DogeLock.deploy(dogecoin.address, dogeForGoat.address)
        await dogeLock.initialize(ownerA.address)
        await dogeLock.approveMax()
        // Minting an initial amount of tokens to ownerA's address in the myOFTA contract
        const initialAmountLD = ethers.utils.parseUnits('100', 8)
        await dogecoin.mint(ownerA.address, initialAmountLD)

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSendLD = ethers.utils.parseUnits('60', 8)
        const tokensToSendSD = tokensToSendLD.mul(CONVERSION_MULTIPLIER)

        const sendParam = [
            eidB,
            ethers.utils.zeroPad(ownerB.address, 32),
            tokensToSendLD,
            tokensToSendLD,
            '0x',
            '0x',
            '0x',
        ]

        // Fetching the native fee for the token send operation
        const [nativeFee] = await dogeForGoat.quoteSend(sendParam, false)

        // Approving the native fee to be spent by the myOFTA contract
        await dogecoin.connect(ownerA).approve(dogeLock.address, tokensToSendLD)
        await dogeLock.connect(ownerA).lock(tokensToSendLD)
        await dogeLock.connect(ownerA).bridge(sendParam, [nativeFee, 0], { value: nativeFee })

        // Fetching the final token balances of ownerA and ownerB
        const finalBalanceA = await dogecoin.balanceOf(ownerA.address)
        const finalBalanceB = await goatOFT.balanceOf(ownerB.address)
        const finalBalanceOFT = await dogecoin.balanceOf(dogeForGoat.address)

        // Asserting that the final balances are as expected after the send operation
        expect(finalBalanceA).eql(initialAmountLD.sub(tokensToSendLD))
        expect(finalBalanceB).eql(tokensToSendSD)
        expect(finalBalanceOFT).eql(tokensToSendLD)
    })
})
