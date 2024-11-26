import { ethers } from 'hardhat'
import { BigNumber, Contract, ContractFactory } from 'ethers'

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

    console.log('Mock Token:', token.address)
    console.log('Mock Endpoint:', mockEndpointV2A.address)
    console.log('Doge Lock:', dogeLock.address)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
