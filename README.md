## Audit Report

You can find the full audit report [here](https://hackmd.io/@offbeatsecurity/dogelock-review).

## Deployed Contracts

> Dogecoin

| Contract   | BSC Mainnet Address (30102)                | BSC Testnet Address (40102)                |
| ---------- | ------------------------------------------ | ------------------------------------------ |
| Dogecoin   | 0xbA2aE424d960c26247Dd6c32edC70B295c744C43 | 0x9A359f736674913e405Eb64C2048c6293DC97CbF |
| Lock Logic | 0x1d7e4Df7Ad00e3dbBF444515232E22e5C6D173e8 | 0x2d3B6b33E1cF574AB0d007A8154c8f97aa528795 |
| Lock       | 0xaAC2155CceA674b0f5b0AAA81D5Ac85C510e9e98 | 0x4461ccD816E9952Ebd0BaF0661ac4E28de0d5095 |
| Adapter    | 0x0E9A492Bd9D4241028f794b9580847e5C3444776 | 0xa1952fFa805b9F2b711b61f005C6e56054cCA016 |

| Contract | Goat Mainnet Address (30361)               | Goat Testnet Address (40356)               |
| -------- | ------------------------------------------ | ------------------------------------------ |
| OFT      | 0x1E0d0303a8c4aD428953f5ACB1477dB42bb838cf | 0xa0449799bb779CE75FF37d8fd9A486603F24B804 |

> BTCB

| Contract | BSC Mainnet Address (30102)                | BSC Testnet Address (40102)                |
| -------- | ------------------------------------------ | ------------------------------------------ |
| BTCB     | 0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c | 0x6ce8dA28E2f864420840cF74474eFf5fD80E65B8 |
| Adapter  | 0x5b7b01bEBCdf408Dd14429A9b12465AB45204B13 | 0xD9A5551652a1DF93E6242A39925CEb2133Ea2312 |

| Contract | Goat Mainnet Address (30361)               | Goat Testnet Address (40356)               |
| -------- | ------------------------------------------ | ------------------------------------------ |
| OFT      | 0xfe41e7e5cB3460c483AB2A38eb605Cda9e2d248E | 0xf612A339E85c2E5F4dD1645829ed5898d08F6649 |

## 1) Setup Project

#### Installing dependencies

We recommend using `pnpm` as a package manager (but you can of course use a package manager of your choice):

```bash
pnpm install
```

#### Compiling your contracts

This project supports both `hardhat` and `forge` compilation. By default, the `compile` command will execute both:

```bash
pnpm compile
```

If you prefer one over the other, you can use the tooling-specific commands:

```bash
pnpm compile:forge
pnpm compile:hardhat
```

Or adjust the `package.json` to for example remove `forge` build:

```diff
- "compile": "$npm_execpath run compile:forge && $npm_execpath run compile:hardhat",
- "compile:forge": "forge build",
- "compile:hardhat": "hardhat compile",
+ "compile": "hardhat compile"
```

#### Running tests

Similarly to the contract compilation, we support both `hardhat` and `forge` tests. By default, the `test` command will execute both:

```bash
pnpm test
```

If you prefer one over the other, you can use the tooling-specific commands:

```bash
pnpm test:forge
pnpm test:hardhat
```

Or adjust the `package.json` to for example remove `hardhat` tests:

```diff
- "test": "$npm_execpath test:forge && $npm_execpath test:hardhat",
- "test:forge": "forge test",
- "test:hardhat": "$npm_execpath hardhat test"
+ "test": "forge test"
```

## 2) Deploying Contracts

Set up deployer wallet/account:

- Rename `.env.example` -> `.env`
- Choose your preferred means of setting up your deployer wallet/account:

```
MNEMONIC="test test test test test test test test test test test junk"
or...
PRIVATE_KEY="0xabc...def"
```

- Fund this address with the corresponding chain's native tokens you want to deploy to.

To deploy your contracts to your desired blockchains, run the following command in your project's folder:

```bash
npx hardhat run deploy/DEPLOY_SCRIPT.ts
```

To deploy Layer Zero contracts, run the following command:

```bash
npx hardhat lz:deploy
```

More information about available CLI arguments can be found using the `--help` flag:

```bash
npx hardhat lz:deploy --help
```
