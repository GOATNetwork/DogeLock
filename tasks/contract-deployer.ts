import { BigNumber } from 'ethers'
import { task } from 'hardhat/config'
import { Options } from '@layerzerolabs/lz-v2-utilities'

task('deploy:source', 'deploying on source chain (deploying Lock and DogeForGoat contracts).')
    .addOptionalParam('owner', 'contract owner')
    .addOptionalParam('dogecoin', 'Dogecoin contract of source chain')
    .addOptionalParam('initialvalue', 'The amount dogecoin minted when deployed')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        const owner = arg.owner == undefined ? deployerAddr : arg.owner
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))
        console.log('Contract Owner: ', owner)
        const eid = network.config.eid
        let endpoint
        if (network.config.endpoint == undefined) {
            const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock')
            const mockEndpointV2A = await EndpointV2Mock.deploy(1)
            endpoint = mockEndpointV2A.address
        } else {
            endpoint = network.config.endpoint
        }
        console.log('eid:', eid, ' endpoint:', endpoint)

        const DogecoinMock = await ethers.getContractFactory('DogecoinMock')
        let dogecoin
        if (arg.dogecoin == undefined) {
            dogecoin = await DogecoinMock.deploy()
            console.log('Deployed Dogecoin: ', dogecoin.address)
        } else {
            dogecoin = await DogecoinMock.attach(arg.dogecoin)
        }

        const UpgradeableProxy = await ethers.getContractFactory('UpgradeableProxy')
        const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')
        const DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')

        // deploy DogeForGoat
        const dfgOftLogic = await DogeForGoat.deploy(dogecoin.address, endpoint)
        await ethers.provider.waitForTransaction(dfgOftLogic.deployTransaction.hash)
        const dfgProxy = await UpgradeableProxy.deploy(dfgOftLogic.address, owner)
        await ethers.provider.waitForTransaction(dfgProxy.deployTransaction.hash)
        const dfgOft = DogeForGoat.attach(dfgProxy.address)
        await dfgOft.initialize(owner)

        // deploy DogeLock
        const dogeLockLogic = await DogeLock.deploy(dogecoin.address, dfgProxy.address)
        await ethers.provider.waitForTransaction(dogeLockLogic.deployTransaction.hash)
        const lockProxy = await UpgradeableProxy.deploy(dogeLockLogic.address, owner)
        await ethers.provider.waitForTransaction(lockProxy.deployTransaction.hash)
        const dogeLock = DogeLock.attach(lockProxy.address)
        await dogeLock.initialize(owner)

        // mint Dogecoin on localhost or testnet
        if (arg.initialvalue != undefined) {
            await dogecoin.mint(deployerAddr, BigNumber.from(arg.initialvalue))
        }

        console.log('----- Source Chain -----')
        console.log('Doge Lock:', dogeLock.address)
        console.log('Doge Lock Admin Proxy:', await lockProxy.proxyAdmin())
        console.log('Doge for Goat:', dfgOft.address)
        console.log('Doge For Goat Admin Proxy:', await dfgProxy.proxyAdmin())
    })

task('deploy:dest', 'deploying on destination chain (deploying OFT to receive DogeForGoat)')
    .addParam('eidpeer', 'Peer eid')
    .addParam('oftpeer', 'Peer OFT contract')
    .addOptionalParam('owner', 'contract owner')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        const owner = arg.owner == undefined ? deployerAddr : arg.owner
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))
        console.log('Contract Owner: ', owner)
        let endpoint
        if (network.config.endpoint == undefined) {
            const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock')
            const mockEndpointV2A = await EndpointV2Mock.deploy(1)
            endpoint = mockEndpointV2A.address
        } else {
            endpoint = network.config.endpoint
        }

        const GoatOFT = await ethers.getContractFactory('GoatOFT')
        const goatOFT = await GoatOFT.deploy(endpoint, owner)
        await ethers.provider.waitForTransaction(goatOFT.deployTransaction.hash)

        if (network.config.configOption != undefined) {
            console.log('   Setting LayerZero config options...')
            const EndpointFactory = await ethers.getContractFactory('EndpointV2Mock')
            const endpointContract = await EndpointFactory.attach(endpoint)
            await endpointContract.setSendLibrary(goatOFT.address, arg.eidpeer, network.config.configOption.sendLib)
            await endpointContract.setReceiveLibrary(
                goatOFT.address,
                arg.eidpeer,
                network.config.configOption.receiveLib
            )
        }

        const options = Options.newOptions().addExecutorLzReceiveOption(60000, 0).toHex().toString()
        const enforcedOptionParam = [
            arg.eidpeer, // destination endpoint eid
            1, // SEND message type
            options,
        ]
        await goatOFT.setEnforcedOptions([enforcedOptionParam])
        await await goatOFT.setPeer(arg.eidpeer, ethers.utils.zeroPad(arg.oftpeer, 32))

        console.log('----- Destination Chain -----')
        console.log('GoatOFT:', goatOFT.address)
    })

task('deploy:lock', 'deploying DogeLock on source chain.')
    .addOptionalParam('oft', 'DogeLock logic contract')
    .addOptionalParam('dogecoin', 'Dogecoin contract of source chain')
    .addOptionalParam('logic', 'DogeLock logic contract')
    .addOptionalParam('owner', 'contract owner')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        const owner = arg.owner == undefined ? deployerAddr : arg.owner
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))
        console.log('Contract Owner: ', owner)

        const DogecoinMock = await ethers.getContractFactory('DogecoinMock')
        let dogecoin
        if (arg.dogecoin == undefined) {
            dogecoin = await DogecoinMock.deploy()
            console.log('Deployed Dogecoin: ', dogecoin.address)
        } else {
            dogecoin = await DogecoinMock.attach(arg.dogecoin)
        }

        const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')

        // deploy DogeLock
        const oftContract = arg.oft ? arg.oft : ethers.constants.AddressZero
        if (arg.logic == undefined) {
            console.log('Dogecoin: ', dogecoin.address, ', oft: ', oftContract)
            const dogeLockLogic = await DogeLock.deploy(dogecoin.address, oftContract)
            console.log('----- DogeLock Logic -----')
            console.log('Doge Lock logic:', dogeLockLogic.address)
        } else {
            const logicContract = arg.logic
            const UpgradeableProxy = await ethers.getContractFactory('UpgradeableProxy')
            const lockProxy = await UpgradeableProxy.deploy(logicContract, owner)
            await ethers.provider.waitForTransaction(lockProxy.deployTransaction.hash)
            const dogeLock = DogeLock.attach(lockProxy.address)
            await dogeLock.initialize(owner)

            console.log('----- DogeLock -----')
            console.log('Doge Lock:', dogeLock.address)
            console.log('Doge Lock Admin Proxy:', await lockProxy.proxyAdmin())
        }
    })

task('deploy:oft', 'deploying DogeForGoatOFT.')
    .addOptionalParam('owner', 'contract owner')
    .addOptionalParam('dogecoin', 'Dogecoin contract of source chain')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        const owner = arg.owner == undefined ? deployerAddr : arg.owner
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))
        console.log('Contract Owner: ', owner)
        const eid = network.config.eid
        let endpoint
        if (network.config.endpoint == undefined) {
            const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock')
            const mockEndpointV2A = await EndpointV2Mock.deploy(1)
            endpoint = mockEndpointV2A.address
        } else {
            endpoint = network.config.endpoint
        }
        console.log('eid:', eid, ' endpoint:', endpoint)

        const DogecoinMock = await ethers.getContractFactory('DogecoinMock')
        let dogecoin
        if (arg.dogecoin == undefined) {
            dogecoin = await DogecoinMock.deploy()
            console.log('Deployed Dogecoin: ', dogecoin.address)
        } else {
            dogecoin = await DogecoinMock.attach(arg.dogecoin)
        }

        const UpgradeableProxy = await ethers.getContractFactory('UpgradeableProxy')
        const DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')

        // deploy DogeForGoat
        const dfgOftLogic = await DogeForGoat.deploy(dogecoin.address, endpoint)
        await ethers.provider.waitForTransaction(dfgOftLogic.deployTransaction.hash)
        const dfgProxy = await UpgradeableProxy.deploy(dfgOftLogic.address, owner)
        await ethers.provider.waitForTransaction(dfgProxy.deployTransaction.hash)
        const dfgOft = DogeForGoat.attach(dfgProxy.address)
        await dfgOft.initialize(owner)

        console.log('----- OFT -----')
        console.log('Doge for Goat:', dfgOft.address)
        console.log('Doge For Goat Admin Proxy:', await dfgProxy.proxyAdmin())
    })

task('deploy:setup', 'Set Peer and other Layer Zero configurations')
    .addParam('oft', 'OFT contract')
    .addParam('eidpeer', 'Peer eid')
    .addParam('oftpeer', 'Peer OFT contract')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))

        const DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')
        const oft = await DogeForGoat.attach(arg.oft)
        console.log(await oft.name())

        if (network.config.configOption != undefined) {
            let endpoint
            if (network.config.endpoint == undefined) {
                const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock')
                const mockEndpointV2A = await EndpointV2Mock.deploy(1)
                endpoint = mockEndpointV2A.address
            } else {
                endpoint = network.config.endpoint
            }
            const EndpointFactory = await ethers.getContractFactory('EndpointV2Mock')
            const endpointContract = await EndpointFactory.attach(endpoint)
            await endpointContract.setSendLibrary(oft.address, arg.eidpeer, network.config.configOption.sendLib)
            await endpointContract.setReceiveLibrary(oft.address, arg.eidpeer, network.config.configOption.receiveLib)
        }

        const options = Options.newOptions().addExecutorLzReceiveOption(60000, 0).toHex().toString()
        const enforcedOptionParam = [
            arg.eidpeer, // destination endpoint eid
            1, // SEND message type
            options,
        ]
        await oft.setEnforcedOptions([enforcedOptionParam])
        await oft.setPeer(arg.eidpeer, ethers.utils.zeroPad(arg.oftpeer, 32))

        console.log('Peer set', arg.eidpeer, arg.oftpeer)
    })
