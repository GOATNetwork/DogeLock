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
    const DogeForGoatUpgradeable = await ethers.getContractFactory('DogeForGoatUpgradeable')
    const MyOFT = await ethers.getContractFactory('MyOFTMock')
    const UpgradeableProxy = await ethers.getContractFactory('UpgradeableProxy')
    const DogeForGoat = await ethers.getContractFactory('DogeForGoatUpgradeable')

    // source chain
    const dogecoin = await dogecoinMock.deploy()
    const mockEndpointV2A = await EndpointV2Mock.deploy(eidA)
    const dfgOFT = await DogeForGoatUpgradeable.deploy(dogecoin.address, mockEndpointV2A.address)
    const dogeLock = await DogeLock.deploy(dogecoin.address, dfgOFT.address)

    // dest chain
    const mockEndpointV2B = await EndpointV2Mock.deploy(eidB)
    const destOFT = await MyOFT.deploy('Dest OFT', 'DO', mockEndpointV2B.address, deployerAddr)

    // @dev Test Only: Setting destination endpoints in the LZEndpoint mock for each MyOFT instance
    await mockEndpointV2A.setDestLzEndpoint(destOFT.address, mockEndpointV2B.address)
    await mockEndpointV2B.setDestLzEndpoint(dfgOFT.address, mockEndpointV2A.address)

    // upgradeable contract initialize
    await dfgOFT.initialize(deployerAddr)
    await dogeLock.initialize(deployerAddr)

    // set peer
    await dfgOFT.setPeer(eidB, ethers.utils.zeroPad(destOFT.address, 32))
    await destOFT.setPeer(eidA, ethers.utils.zeroPad(dogeLock.address, 32))

    await dogecoin.mint(deployerAddr, ethers.utils.parseUnits('1', 18))

    console.log('-----Source Chain-----')
    console.log('Mock EndpointA:', mockEndpointV2A.address)
    console.log('Dogecoin:', dogecoin.address)
    console.log('Doge Lock:', dogeLock.address)
    console.log('DogeForGoat:', dfgOFT.address)
    console.log('------Dest Chain------')
    console.log('Mock EndpointA:', mockEndpointV2B.address)
    console.log('Destination OFT:', destOFT.address)

    // Save deployment info for subgraph
    const deploymentInfo = {
        DogeLock: dogeLock.address,
        Token: dogecoin.address,
        EndpointV2: mockEndpointV2A.address,
        DogeForGoat: dfgOFT.address,
        blockNumber: (await ethers.provider.getBlock(dogeLock.deployTransaction.blockNumber || 1)).number,
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
