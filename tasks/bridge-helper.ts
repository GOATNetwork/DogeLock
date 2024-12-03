import { BigNumber } from 'ethers'
import { task } from 'hardhat/config'
import { Options } from '@layerzerolabs/lz-v2-utilities'

const CONVERSION_MULTIPLIER = 10 ** 10

task('bridge', 'bridge dogecoin through OFT/Lock')
    .addParam('path', 'Bridge through OFT or Lock')
    .addParam('oft', 'oft contract address')
    .addParam('eid', 'Eid of destination chain')
    .addParam('value', 'The amount to bridge')
    .addOptionalParam('execute', 'Execute the bridging transaction')
    .setAction(async (arg, { ethers, network }) => {
        const [deployer] = await ethers.getSigners()
        const deployerAddr = await deployer.getAddress()
        console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
        console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))

        const OFT = await ethers.getContractFactory('DogeForGoatUpgradeable')
        const oft = await OFT.attach(arg.oft)

        const eid = arg.eid
        const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

        if (arg.path == 'send') {
            console.log('Through send')
            let sendParam = [
                eid,
                ethers.utils.zeroPad(deployerAddr, 32),
                BigNumber.from(arg.value),
                BigNumber.from(arg.value),
                options,
                '0x',
                '0x',
            ]
            const [fee] = await oft.quoteSend(sendParam, false)
            console.log('TX fee: ', fee)
            if (arg.execute != undefined) {
                let tx = await oft.send(sendParam, [fee, 0], deployerAddr, { value: fee })
                console.log(tx)
            }
        } else {
            console.log('Through bridge')
            const Lock = await ethers.getContractFactory('DogeLockUpgradeable')
            const lock = await Lock.attach('0xF156860BCb65Fe5e49955d83Ff6880f799E38084')
            const amount = BigNumber.from(arg.value)

            let sendParam = [
                eid,
                ethers.utils.zeroPad(deployerAddr, 32),
                amount.mul(CONVERSION_MULTIPLIER),
                amount.mul(CONVERSION_MULTIPLIER),
                options,
                '0x',
                '0x',
            ]
            const [fee] = await oft.quoteSend(sendParam, false)
            console.log('TX fee: ', fee)

            if (arg.execute != undefined) {
                let tx = await lock.bridge(oft.address, amount, sendParam, [fee, 0], { value: fee })
                console.log(tx)
            }
        }
    })
