import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { Options } from '@layerzerolabs/lz-v2-utilities'

async function main() {
    const [deployer] = await ethers.getSigners()
    const deployerAddr = await deployer.getAddress()
    console.log('deployerAddr :', deployerAddr)

    const ERC20Mock = await ethers.getContractFactory('GoatOFT')
    const oft = await ERC20Mock.attach('0x920F5eB90efc66f8E9E01C1C3F4F0237062447E2')

    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()
    const sendParam = [
        40161,
        ethers.utils.zeroPad(deployerAddr, 32),
        ethers.utils.parseUnits('3', 18),
        ethers.utils.parseUnits('3', 18),
        // BigNumber.from(0),
        options,
        '0x',
        '0x',
    ]
    const [fee] = await oft.quoteSend(sendParam, false)

    let tx = await oft.send(sendParam, [fee, 0], deployerAddr, { value: fee })

    console.log(tx)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
