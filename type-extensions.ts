import 'hardhat/types/config'

interface OftAdapterConfig {
    tokenAddress: string
}

interface ConfigOption {
    endpoint: string
    sendLib: string
    receiveLib: string
    executor: string
}

declare module 'hardhat/types/config' {
    interface HardhatNetworkUserConfig {
        oftAdapter?: never
        configOption?: ConfigOption
    }

    interface HardhatNetworkConfig {
        oftAdapter?: never
        configOption?: ConfigOption
    }

    interface HttpNetworkUserConfig {
        oftAdapter?: OftAdapterConfig
        configOption?: ConfigOption
    }

    interface HttpNetworkConfig {
        oftAdapter?: OftAdapterConfig
        configOption?: ConfigOption
    }
}
