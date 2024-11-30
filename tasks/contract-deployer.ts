import { BigNumber } from 'ethers'
import { task } from 'hardhat/config'

task('deployOFT', 'Deploy OFT contracts on source/destination chain')
    .addParam('chain', 'Source/Destination chain')
    .addOptionalParam('endpoint', 'Endpoint contract of current chain')
    .addOptionalParam('owner', 'contract owner')
    .addOptionalParam('eidPeer', 'Peer eid')
    .addOptionalParam('oftPeer', 'Peer OFT contract')
    .addOptionalParam('dogecoin', 'Dogecoin contract of source chain')
    .addOptionalParam('initialValue', 'The amount dogecoin minted when deployed')
    .addOptionalParam('oft', 'OFT contract')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))
        const eid = network.config.eid // 40161 sepolia 30102 BSC
        let endpoint = arg.endpoint
        if (eid == undefined) {
            const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock')
            const mockEndpointV2A = await EndpointV2Mock.deploy(1)
            endpoint = mockEndpointV2A.address
        }
        console.log('eid:', eid, ' endpoint:', endpoint)

        if (arg.chain == 'source') {
            const DogecoinMock = await ethers.getContractFactory('DogecoinMock')
            let dogecoin
            if (arg.dogecoin == undefined) {
                dogecoin = await DogecoinMock.deploy()
            } else {
                dogecoin = await DogecoinMock.attach(arg.dogecoin)
            }

            const DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')
            const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')

            const dfgOTF = await DogeForGoat.deploy(dogecoin.address, endpoint)
            const dogeLock = await DogeLock.deploy(dogecoin.address)

            if (arg.owner == undefined) {
                await dogeLock.initialize(deployerAddr)
                await dfgOTF.initialize(deployerAddr)
            } else {
                await dogeLock.initialize(arg.owner)
                await dfgOTF.initialize(arg.owner)
            }

            if (arg.initialValue != undefined) {
                await dogecoin.mint(deployerAddr, BigNumber.from(arg.initialValue))
            }

            console.log('----- Source Chain -----')
            console.log('Doge Lock:', dogeLock.address)
            console.log('Doge for Goat:', dfgOTF.address)
        } else if (arg.chain == 'dest') {
            const GoatOFT = await ethers.getContractFactory('GoatOFT')
            let goatOFT
            if (arg.owner == undefined) {
                goatOFT = await GoatOFT.deploy('Goat Doge', 'GD', endpoint, deployerAddr)
            } else {
                goatOFT = await GoatOFT.deploy('Goat Doge', 'GD', endpoint, arg.owner)
            }

            if (arg.eidPeer != undefined && arg.oftPeer != undefined) {
                await goatOFT.setPeer(arg.eidPeer, ethers.utils.zeroPad(arg.oftPeer, 32))
            }

            console.log('----- Destination Chain -----')
            console.log('GoatOFT:', goatOFT.address)
        } else {
            if (arg.oft == undefined) {
                console.error('OFT address not set')
                return
            }
            if (arg.eidPeer == undefined || arg.oftPeer == undefined) {
                console.error('Peer info not set')
                return
            }
            const DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')
            const oft = await DogeForGoat.attach(arg.oft)
            await oft.setPeer(arg.eidPeer, ethers.utils.zeroPad(arg.oftPeer, 32))

            console.log('Peer set', arg.eidPeer, arg.oftPeer)
        }
    })
