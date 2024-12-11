## Deployed Contracts

### BSC (source chain)

| Contract   | Mainnet Address                            | Testnet Address                            |
| ---------- | ------------------------------------------ | ------------------------------------------ |
| Dogecoin   | 0xbA2aE424d960c26247Dd6c32edC70B295c744C43 | 0x9A359f736674913e405Eb64C2048c6293DC97CbF |
| Lock Logic | 0x1d7e4Df7Ad00e3dbBF444515232E22e5C6D173e8 | 0x0b52bF217E0FBaa025e0ae9fF0D2Bb5497C22d82 |
| Lock       | 0xaAC2155CceA674b0f5b0AAA81D5Ac85C510e9e98 | 0x4461ccD816E9952Ebd0BaF0661ac4E28de0d5095 |
| OFT        | 0x0000000000000000000000000000000000000000 | 0xfd4CAd694B5eB50a4555ABce2Ee99d5bdC423736 |

### Goat (destination chain)

| Contract | Address |
| -------- | ------- |
| OFT      | 0x00    |

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
