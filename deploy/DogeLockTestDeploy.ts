import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    console.log('deployerAddr:', deployer)

    // deploy Mock Token
    const token = await deploy('MyERC20Mock', {
        from: deployer,
        args: ['Token', 'TOKEN'],
        log: true,
    })

    // deploy Mock Endpoint
    const mockEndpointV2 = await deploy('EndpointMock', {
        from: deployer,
        args: [1, deployer],
        log: true,
    })

    // deploy DogeLock
    const dogeLock = await deploy('DogeLockUpgradeable', {
        from: deployer,
        args: [token.address, mockEndpointV2.address, 0],
        log: true,
    })

    console.log('Mock Token:', token.address)
    console.log('Mock Endpoint:', mockEndpointV2.address)
    console.log('Doge Lock:', dogeLock.address)
}

export default func
func.tags = ['DogeLockTest']
