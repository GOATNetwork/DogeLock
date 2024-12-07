import 'hardhat/types/config'

interface OftAdapterConfig {
    tokenAddress: string
}

interface ConfigOption {
    sendLib: string
    receiveLib: string
    executor: string
}

declare module 'hardhat/types/config' {
    interface HardhatNetworkUserConfig {
        oftAdapter?: never
        configOption?: ConfigOption
        endpoint?: string
    }

    interface HardhatNetworkConfig {
        oftAdapter?: never
        configOption?: ConfigOption
        endpoint?: string
    }

    interface HttpNetworkUserConfig {
        oftAdapter?: OftAdapterConfig
        configOption?: ConfigOption
        endpoint?: string
    }

    interface HttpNetworkConfig {
        oftAdapter?: OftAdapterConfig
        configOption?: ConfigOption
        endpoint?: string
    }
}
