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
    .addParam('peereid', 'Peer eid')
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
            await endpointContract.setSendLibrary(goatOFT.address, arg.peereid, network.config.configOption.sendLib)
            await endpointContract.setReceiveLibrary(
                goatOFT.address,
                arg.peereid,
                network.config.configOption.receiveLib
            )
        }

        const options = Options.newOptions().addExecutorLzReceiveOption(60000, 0).toHex().toString()
        const enforcedOptionParam = [
            arg.peereid, // destination endpoint eid
            1, // SEND message type
            options,
        ]
        await goatOFT.setEnforcedOptions([enforcedOptionParam])
        await await goatOFT.setPeer(arg.peereid, ethers.utils.zeroPad(arg.oftpeer, 32))

        console.log('----- Destination Chain -----')
        console.log('GoatOFT:', goatOFT.address)
    })

task('deploy:lock', 'deploying DogeLock on source chain.')
    .addOptionalParam('adapter', 'DogeLock logic contract')
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
        if (arg.logic == undefined) {
            const adapterContract = arg.adapter ? arg.adapter : ethers.constants.AddressZero
            console.log('Dogecoin: ', dogecoin.address, ', adapter: ', adapterContract)
            const dogeLockLogic = await DogeLock.deploy(dogecoin.address, adapterContract)
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

task('deploy:adapter', 'deploying DogeAdapter.')
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
        const DogeAdapter = await ethers.getContractFactory('DogeAdapterUpgradeable')

        // deploy DogeAdapter
        const dogeAdapterLogic = await DogeAdapter.deploy(dogecoin.address, endpoint)
        await ethers.provider.waitForTransaction(dogeAdapterLogic.deployTransaction.hash)

        const dogeAdapterProxy = await UpgradeableProxy.deploy(dogeAdapterLogic.address, owner)
        await ethers.provider.waitForTransaction(dogeAdapterProxy.deployTransaction.hash)

        const dogeAdapter = DogeAdapter.attach(dogeAdapterProxy.address)
        await dogeAdapter.initialize(owner)

        console.log('----- Adapter -----')
        console.log('Doge for Goat:', dogeAdapter.address)
        console.log('Doge For Goat Admin Proxy:', await dogeAdapterProxy.proxyAdmin())
    })

task('deploy:setup', 'Set Peer and other Layer Zero configurations')
    .addParam('adapter', 'OFT contract')
    .addParam('peereid', 'Peer eid')
    .addParam('peeraddr', 'Peer OFT contract')
    .addOptionalParam('setconfig', 'Set config options')
    .addOptionalParam('setenforced', 'Set config options')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))

        const DogeAdapter = await ethers.getContractFactory('DogeAdapterUpgradeable')
        const adapter = await DogeAdapter.attach(arg.adapter)

        if (arg.setconfig && network.config.configOption != undefined) {
            console.log(network.config.configOption)
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

            await endpointContract.setSendLibrary(adapter.address, arg.peereid, network.config.configOption.sendLib)
            await endpointContract.setReceiveLibrary(
                adapter.address,
                arg.peereid,
                network.config.configOption.receiveLib,
                0
            )

            const ulnConfig = {
                confirmations: 5, // Example value, replace with actual
                requiredDVNCount: 2, // Example value, replace with actual
                optionalDVNCount: 0, // Example value, replace with actual
                optionalDVNThreshold: 0, // Example value, replace with actual
                requiredDVNs: network.config.configOption.requiredDVNs, // Replace with actual addresses
                optionalDVNs: [], // Replace with actual addresses
            }
            const executorConfig = {
                maxMessageSize: 10000, // Example value, replace with actual
                executorAddress: network.config.configOption.executor, // Replace with the actual executor address
            }

            // Encode UlnConfig using defaultAbiCoder
            const configTypeUlnStruct =
                'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'
            const encodedUlnConfig = ethers.utils.defaultAbiCoder.encode([configTypeUlnStruct], [ulnConfig])
            const setConfigParamUln = {
                eid: arg.peereid,
                configType: 2, // ULN_CONFIG_TYPE
                config: encodedUlnConfig,
            }

            // Encode ExecutorConfig using defaultAbiCoder
            const configTypeExecutorStruct = 'tuple(uint32 maxMessageSize, address executorAddress)'
            const encodedExecutorConfig = ethers.utils.defaultAbiCoder.encode(
                [configTypeExecutorStruct],
                [executorConfig]
            )
            const setConfigParamExecutor = {
                eid: arg.peereid,
                configType: 1, // EXECUTOR_CONFIG_TYPE
                config: encodedExecutorConfig,
            }
            // console.log(setConfigParamExecutor)

            const tx = await endpointContract.setConfig(
                adapter.address,
                network.config.configOption.sendLib,
                // [setConfigParamExecutor] // Array of SetConfigParam structs
                [setConfigParamUln, setConfigParamExecutor] // Array of SetConfigParam structs
            )

            console.log('Transaction sent:', tx.hash)
            await ethers.provider.waitForTransaction(tx.hash)
        }

        if (arg.setenforced) {
            const options = Options.newOptions().addExecutorLzReceiveOption(60000, 0).toHex().toString()
            const enforcedOptionParam = [
                arg.peereid, // destination endpoint eid
                1, // SEND message type
                options,
            ]
            await adapter.setEnforcedOptions([enforcedOptionParam])
        }

        await adapter.setPeer(arg.peereid, ethers.utils.zeroPad(arg.peeraddr, 32))
        console.log('Peer set', arg.peereid, arg.peeraddr)
    })

task('deploy:reset', 'Reset Layer Zero configurations')
    .addParam('oft', 'OFT contract')
    .addParam('eid', 'Peer eid')
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
            throw new Error('not set')
        }

        const EndpointFactory = await ethers.getContractFactory('EndpointV2Mock')
        const endpointContract = await EndpointFactory.attach(network.config.endpoint!)

        // ULN Configuration Reset Params
        const confirmations = 0
        const optionalDVNCount = 0
        const requiredDVNCount = 0
        const optionalDVNThreshold = 0
        const requiredDVNs: string[] = []
        const optionalDVNs: string[] = []

        const ulnConfigData = {
            confirmations,
            requiredDVNCount,
            optionalDVNCount,
            optionalDVNThreshold,
            requiredDVNs,
            optionalDVNs,
        }
        const configTypeUlnStruct =
            'tuple(uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs)'

        const ulnConfigEncoded = ethers.utils.defaultAbiCoder.encode([configTypeUlnStruct], [ulnConfigData])

        const resetConfigParamUln = {
            eid: arg.eid, // Replace with the target chain's endpoint ID
            configType: 2,
            config: ulnConfigEncoded,
        }

        // Executor Configuration Reset Params
        const maxMessageSize = 0 // Representing no limit on message size
        const executorAddress = '0x0000000000000000000000000000000000000000' // Representing no specific executor address

        const configTypeExecutorStruct = 'tuple(uint32 maxMessageSize, address executorAddress)'
        const executorConfigData = {
            maxMessageSize,
            executorAddress,
        }

        const executorConfigEncoded = ethers.utils.defaultAbiCoder.encode(
            [configTypeExecutorStruct],
            [executorConfigData]
        )

        const resetConfigParamExecutor = {
            eid: arg.eid, // Replace with the target chain's endpoint ID
            configType: 1,
            config: executorConfigEncoded,
        }

        const resetTx = await endpointContract.setConfig(arg.oft, arg.messagelibAddress, [
            resetConfigParamUln,
            resetConfigParamExecutor,
        ])
        console.log(resetTx)
    })
