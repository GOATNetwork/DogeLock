import { ethers } from 'hardhat'
import { BigNumber, Contract, ContractFactory } from 'ethers'

async function main() {
    const [deployer] = await ethers.getSigners()
    const deployerAddr = await deployer.getAddress()
    console.log('deployerAddr :', deployerAddr)

    const EndpointV2Mock = await ethers.getContractFactory('EndpointMock')
    const ERC20Mock = await ethers.getContractFactory('MyERC20Mock')
    const DogeLock = await ethers.getContractFactory('DogeLockUpgradeable')
    const MyOFTAdapter = await ethers.getContractFactory('MyOFTAdapter')

    // chain A:
    const tokenA = await ERC20Mock.deploy('Token', 'TOKEN')
    const mockEndpointV2A = await EndpointV2Mock.deploy(1, deployerAddr)
    const dogeLock = await DogeLock.deploy(tokenA.address, mockEndpointV2A.address, BigNumber.from(0))

    // chain B:
    const tokenB = await ERC20Mock.deploy('Token', 'TOKEN')
    const mockEndpointV2B = await EndpointV2Mock.deploy(2, deployerAddr)
    const myOFTAdapter = await MyOFTAdapter.deploy(tokenB.address, mockEndpointV2A.address, deployerAddr)

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
