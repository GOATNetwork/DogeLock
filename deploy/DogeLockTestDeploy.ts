import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'

async function main() {
    const [deployer] = await ethers.getSigners()
    const deployerAddr = await deployer.getAddress()
    console.log('deployerAddr :', deployerAddr)

    const eidA = 1
    const eidB = 2

    const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock')
    const ERC20Mock = await ethers.getContractFactory('DogecoinMock')
    const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')
    const MyOFTAdapter = await ethers.getContractFactory('MyOFTAdapter')

    // chain A:
    const tokenA = await ERC20Mock.deploy('Token', 'TOKEN')
    const mockEndpointV2A = await EndpointV2Mock.deploy(eidA)
    const dogeLock = await DogeLock.deploy(tokenA.address, mockEndpointV2A.address, BigNumber.from(0))

    // chain B:
    const tokenB = await ERC20Mock.deploy('Token', 'TOKEN')
    const mockEndpointV2B = await EndpointV2Mock.deploy(eidB)
    const myOFTAdapter = await MyOFTAdapter.deploy(tokenB.address, mockEndpointV2A.address, deployerAddr)

    // @dev Test Only: Setting destination endpoints in the LZEndpoint mock for each MyOFT instance
    await mockEndpointV2A.setDestLzEndpoint(myOFTAdapter.address, mockEndpointV2B.address)
    await mockEndpointV2B.setDestLzEndpoint(dogeLock.address, mockEndpointV2A.address)

    await dogeLock.initialize(deployerAddr)
    await dogeLock.setPeer(eidB, ethers.utils.zeroPad(myOFTAdapter.address, 32))
    await myOFTAdapter.setPeer(eidA, ethers.utils.zeroPad(dogeLock.address, 32))

    await tokenA.mint(deployerAddr, ethers.utils.parseUnits('100', 8))

    console.log('-----Chain A-----')
    console.log('Mock TokenA:', tokenA.address)
    console.log('Mock EndpointA:', mockEndpointV2A.address)
    console.log('Doge Lock:', dogeLock.address)
    console.log('-----Chain B-----')
    console.log('Mock TokenA:', tokenB.address)
    console.log('Mock EndpointA:', mockEndpointV2B.address)
    console.log('Doge Lock:', myOFTAdapter.address)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
