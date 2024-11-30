import * as fs from 'fs'
import * as path from 'path'

import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

async function main() {
    const [deployer] = await ethers.getSigners()
    const deployerAddr = await deployer.getAddress()
    console.log('deployerAddr :', deployerAddr, ' Balance: ', await ethers.provider.getBalance(deployerAddr))

    const eid = hre.network.config.eid // 40161 sepolia 30102 BSC

    const dogecoin = '0x6847D8C9DB2bC2a0086Cb4Ba067e7f1112ADb6E9'
    const endpoint = '0x6EDCE65403992e310A62460808c4b910D972f10f' // sepolia
    // const endpoint = '0x1a44076050125825900e736c501f859c50fE728c' // BSC mainnet
    console.log('eid:', eid, ' endpoint:', endpoint)

    const DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')
    const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')

    const dfgOTF = await DogeForGoat.deploy(dogecoin, endpoint)
    const dogeLock = await DogeLock.deploy(dogecoin)

    await dogeLock.initialize(deployerAddr)
    await dfgOTF.initialize(deployerAddr)

    // await dogecoin.mint(deployerAddr, ethers.utils.parseUnits('10000', 8))

    console.log('----- BSC Chain -----')
    console.log('Doge Lock:', dogeLock.address)
    console.log('Doge for Goat:', dfgOTF.address)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
