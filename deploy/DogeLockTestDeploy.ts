import * as fs from 'fs'
import * as path from 'path'

import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

async function main() {
    const [deployer] = await ethers.getSigners()
    const deployerAddr = await deployer.getAddress()
    console.log('deployerAddr :', deployerAddr)

    const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')
    const ERC20Mock = await ethers.getContractFactory('MyERC20Mock')
    const EndpointV2Mock = await ethers.getContractFactory('EndpointMock')

    const token = await ERC20Mock.deploy('Token', 'TOKEN')
    const mockEndpointV2A = await EndpointV2Mock.deploy(1, deployerAddr)
    const dogeLock = await DogeLock.deploy(token.address, mockEndpointV2A.address, BigNumber.from(0))
    await dogeLock.initialize(deployerAddr)

    console.log('Mock Token:', token.address)
    console.log('Mock Endpoint:', mockEndpointV2A.address)
    console.log('Doge Lock:', dogeLock.address)

    // Save deployment info for subgraph
    const deploymentInfo = {
        DogeLock: dogeLock.address,
        Token: token.address,
        EndpointV2: mockEndpointV2A.address,
        blockNumber: (await ethers.provider.getBlock('latest')).number,
    }

    const filePath = path.join(__dirname, '../subgraph/localnet.json')
    fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2))
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
