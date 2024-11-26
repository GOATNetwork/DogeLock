import { DeployFunction } from 'hardhat-deploy/types'

const contractName = 'MyOFTAdapter'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deploy, get } = deployments
    const { deployer } = await getNamedAccounts()

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    const endpointMock = await get('EndpointMock')
    const mockToken = await get('MyERC20Mock')

    const { address } = await deploy(contractName, {
        from: deployer,
        args: [
            mockToken.address, // use our mock token
            endpointMock.address, // use our mock endpoint
            deployer,
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
}

deploy.tags = [contractName]
deploy.dependencies = ['EndpointMock', 'MyERC20Mock'] // add dependencies

export default deploy
