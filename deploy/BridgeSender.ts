import { BigNumber } from 'ethers'
import { ethers, network } from 'hardhat'
import { Options } from '@layerzerolabs/lz-v2-utilities'

async function main() {
    const [deployer] = await ethers.getSigners()
    const deployerAddr = await deployer.getAddress()
    console.log('network', network.name, (await ethers.provider.getNetwork()).chainId)
    console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))

    const OFT = await ethers.getContractFactory('DogeForGoatUpgradeable')
    const oft = await OFT.attach('0x218ab55484482409aAfD035066eb1e0315BE0084')

    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()
    let sendParam = [
        40161,
        ethers.utils.zeroPad(deployerAddr, 32),
        BigNumber.from('50000000000000000000'),
        BigNumber.from('50000000000000000000'),
        options,
        '0x',
        '0x',
    ]
    const [fee] = await oft.quoteSend(sendParam, false)
    console.log(fee)

    let tx = await oft.send(sendParam, [fee, 0], deployerAddr, { value: fee })
    console.log(tx)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
