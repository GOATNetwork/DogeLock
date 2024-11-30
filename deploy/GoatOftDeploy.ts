import * as fs from 'fs'
import * as path from 'path'

import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

async function main() {
    const [deployer] = await ethers.getSigners()
    const deployerAddr = await deployer.getAddress()
    console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))

    const eid = hre.network.config.eid
    const eidPeer = 40161 // 40161 sepolia 40102 BSC testnet
    const peerOft = '0x159320C22cA561282427d0b65C0FE28Bbb3498DC'

    const endpoint = '0x6EDCE65403992e310A62460808c4b910D972f10f' // BSC testnet

    const GoatOFT = await ethers.getContractFactory('GoatOFT')
    const goatOFT = await GoatOFT.deploy('Goat Doge', 'GD', endpoint, deployerAddr)

    await goatOFT.setPeer(eidPeer, ethers.utils.zeroPad(peerOft, 32))

    console.log('----- Goat Chain -----')
    console.log('GoatOFT:', goatOFT.address)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
