import * as fs from 'fs'
import * as path from 'path'

import hre, { ethers } from 'hardhat'

async function main() {
    const [deployer] = await ethers.getSigners()
    const deployerAddr = await deployer.getAddress()
    console.log('deployerAddr :', deployerAddr)

    const eidA = 1
    const eidB = 2

    // Get contract factories
    const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock')
    const dogecoinMock = await ethers.getContractFactory('DogecoinMock')
    const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')
    const MyOFT = await ethers.getContractFactory('MyOFTMock')
    const UpgradeableProxy = await ethers.getContractFactory('UpgradeableProxy')

    // chain A:
    const tokenA = await dogecoinMock.deploy()
    const mockEndpointV2A = await EndpointV2Mock.deploy(eidA)
    const dogeLockImpl = await DogeLock.deploy(tokenA.address)

    // Deploy proxy with implementation
    const dogeLockProxy = await UpgradeableProxy.deploy(dogeLockImpl.address, deployerAddr)
    // Get DogeLock interface at proxy address
    const dogeLock = DogeLock.attach(dogeLockProxy.address)

    // chain B:
    const tokenB = await dogecoinMock.deploy()
    const mockEndpointV2B = await EndpointV2Mock.deploy(eidB)
    const myOFTAdapter = await MyOFT.deploy('MyOFT', 'MOFT', mockEndpointV2A.address, deployerAddr)

    // Set up endpoints and initialize contracts
    await mockEndpointV2A.setDestLzEndpoint(myOFTAdapter.address, mockEndpointV2B.address)
    await mockEndpointV2B.setDestLzEndpoint(dogeLock.address, mockEndpointV2A.address)

    await dogeLock.initialize(deployerAddr)

    await tokenA.mint(deployerAddr, ethers.utils.parseUnits('100000000', 8))

    console.log('-----Chain A-----')
    console.log('Mock TokenA:', tokenA.address)
    console.log('Mock EndpointA:', mockEndpointV2A.address)
    console.log('Doge Lock:', dogeLock.address)
    console.log('-----Chain B-----')
    console.log('Mock TokenB:', tokenB.address)
    console.log('Mock EndpointB:', mockEndpointV2B.address)
    console.log('OFT Adapter:', myOFTAdapter.address)

    // Save deployment info for subgraph
    const deploymentInfo = {
        DogeLock: dogeLock.address,
        Token: tokenA.address,
        EndpointV2: mockEndpointV2A.address,
        blockNumber: (await ethers.provider.getBlock('latest')).number,
    }

    const network = hre.network.name

    const fileName = `${network}.json`
    const filePath = path.join(__dirname, '../subgraph', fileName)

    fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2))
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
