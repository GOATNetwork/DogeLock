import { BigNumber } from 'ethers'
import { task } from 'hardhat/config'

const CONVERSION_MULTIPLIER = 10 ** 10

task('bridge:oft', 'bridge dogecoin through OFT')
    .addParam('oft', 'oft contract address')
    .addParam('eid', 'Eid of destination chain')
    .addParam('value', 'The amount to bridge')
    .addOptionalParam('execute', 'Execute the bridging transaction')
    .addOptionalParam('receiver', 'Token receiver on the destination chain')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        const receiver = arg.receiver ? arg.receiver : deployerAddr
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr: ', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))
        console.log('Token receiver: ', receiver)

        const eid = arg.eid

        const OFT = await ethers.getContractFactory('GoatOFT')
        const oft = await OFT.attach(arg.oft)

        const sendParam = [
            eid,
            ethers.utils.zeroPad(receiver, 32),
            BigNumber.from(arg.value),
            BigNumber.from(arg.value),
            '0x',
            '0x',
            '0x',
        ]
        const [fee] = await oft.quoteSend(sendParam, false)
        console.log('TX fee: ', fee)
        if (arg.execute != undefined) {
            const tx = await oft.send(sendParam, [fee, 0], deployerAddr, { value: fee })
            console.log(tx)
        }
    })

task('bridge:lock', 'bridge dogecoin through Lock')
    .addParam('eid', 'Eid of destination chain')
    .addParam('oft', 'oft contract address')
    .addParam('value', 'The amount to bridge')
    .addParam('lock', 'DogeLock contract address')
    .addOptionalParam('execute', 'Execute the bridging transaction')
    .addOptionalParam('receiver', 'Token receiver on the destination chain')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        const receiver = arg.receiver ? arg.receiver : deployerAddr
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr: ', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))
        console.log('Token receiver: ', receiver)
        const eid = arg.eid

        const OFT = await ethers.getContractFactory('AdapterUpgradeable')
        const oft = await OFT.attach(arg.oft)
        const Lock = await ethers.getContractFactory('DogeLockUpgradeable')
        const lock = await Lock.attach(arg.lock)

        const amount = BigNumber.from(arg.value)
        const sendParam = [eid, ethers.utils.zeroPad(receiver, 32), amount, amount, '0x', '0x', '0x']
        const [fee] = await oft.quoteSend(sendParam, false)
        console.log('TX fee: ', fee)

        if (arg.execute != undefined) {
            const tx = await lock.bridge(amount, sendParam, [fee, 0], { value: fee })
            console.log(tx)
        }
    })
