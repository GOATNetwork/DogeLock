import { BigNumber } from 'ethers'
import { task } from 'hardhat/config'
import { Options } from '@layerzerolabs/lz-v2-utilities'

task('deployOFT', 'Deploy OFT contracts on source/destination chain')
    .addParam('chain', 'Source/Destination chain')
    .addOptionalParam('owner', 'contract owner')
    .addOptionalParam('dogecoin', 'Dogecoin contract of source chain')
    .addOptionalParam('eidpeer', 'Peer eid')
    .addOptionalParam('oftpeer', 'Peer OFT contract')
    .addOptionalParam('initialvalue', 'The amount dogecoin minted when deployed')
    .addOptionalParam('oft', 'OFT contract')
    .addOptionalParam('preview', 'Is previewing the deploy chain info')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        const owner = arg.owner == undefined ? deployerAddr : arg.owner
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))
        console.log('Contract Owner: ', owner)
        const eid = network.config.eid // 40161 sepolia 30102 BSC
        let endpoint
        if (network.config.configOption == undefined) {
            const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock')
            const mockEndpointV2A = await EndpointV2Mock.deploy(1)
            endpoint = mockEndpointV2A.address
        } else {
            endpoint = network.config.configOption.endpoint
        }
        console.log('eid:', eid, ' endpoint:', endpoint)
        if (arg.preview != 'false') {
            return
        }
        /*
         * @dev deploying on source chain (deploying Lock and DogeForGoat contracts).
         * @dev Warning: must set endPoint, dogecoin, owner if deploying on mainnet.
         */
        if (arg.chain == 'source') {
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

            // deploy logic contract
            const dogeLockLogic = await DogeLock.deploy(dogecoin.address)
            const dfgOftLogic = await DogeForGoat.deploy(dogecoin.address, endpoint)

            // deploy proxies and initialize
            const lockProxy = await UpgradeableProxy.deploy(dogeLockLogic.address, owner)
            const dogeLock = DogeLock.attach(lockProxy.address)
            await dogeLock.initialize(owner)

            const dfgProxy = await UpgradeableProxy.deploy(dfgOftLogic.address, owner)
            const dfgOft = DogeForGoat.attach(dfgProxy.address)
            await dfgOft.initialize(owner)

            // mint Dogecoin on localhost or testnet
            if (arg.initialvalue != undefined) {
                await dogecoin.mint(deployerAddr, BigNumber.from(arg.initialvalue))
            }

            console.log('----- Source Chain -----')
            console.log('Doge Lock:', dogeLock.address)
            console.log('Doge Lock Admin Proxy:', await lockProxy.proxyAdmin())
            console.log('Doge for Goat:', dfgOft.address)
            console.log('Doge For Goat Admin Proxy:', await dfgProxy.proxyAdmin())

            // @dev deploying on destination chain (deploying OFT to receive DogeForGoat)
        } else if (arg.chain == 'dest') {
            const GoatOFT = await ethers.getContractFactory('GoatOFT')
            const goatOFT = await GoatOFT.deploy('Goat Doge', 'GD', endpoint, owner)

            if (arg.eidpeer != undefined && arg.oftpeer != undefined) {
                if (network.config.configOption != undefined) {
                    console.log('   Setting LayerZero config options...')
                    const EndpointFactory = await ethers.getContractFactory('EndpointV2Mock')
                    const endpointContract = await EndpointFactory.attach(endpoint)
                    await endpointContract.setSendLibrary(
                        goatOFT.address,
                        arg.eidpeer,
                        network.config.configOption.sendLib
                    )
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
            }

            console.log('----- Destination Chain -----')
            console.log('GoatOFT:', goatOFT.address)

            // @dev call setPeer for DogeForGoat
        } else {
            if (arg.oft == undefined) {
                console.error('OFT address not set')
                return
            }
            if (arg.eidpeer == undefined || arg.oftpeer == undefined) {
                console.error('Peer info not set')
                return
            }
            const DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')
            const oft = await DogeForGoat.attach(arg.oft)

            if (network.config.configOption != undefined) {
                const EndpointFactory = await ethers.getContractFactory('EndpointV2Mock')
                const endpointContract = await EndpointFactory.attach(endpoint)
                await endpointContract.setSendLibrary(oft.address, arg.eidpeer, network.config.configOption.sendLib)
                await endpointContract.setReceiveLibrary(
                    oft.address,
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
            await oft.setEnforcedOptions([enforcedOptionParam])
            await oft.setPeer(arg.eidpeer, ethers.utils.zeroPad(arg.oftpeer, 32))

            console.log('Peer set', arg.eidpeer, arg.oftpeer)
        }
    })
