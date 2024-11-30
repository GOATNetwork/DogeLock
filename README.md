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

## Task Operations

All tasks should be run with the `--network testnet` parameter.

### Prerequisites

1. Create a `subgraph/testnet.json` file with contract addresses:
```json
{
    "DogeLock": "0xF156860BCb65Fe5e49955d83Ff6880f799E38084",
    "Token": "0x6847D8C9DB2bC2a0086Cb4Ba067e7f1112ADb6E9"
}
```

2. Set up your environment variables in `.env`:
```env
PRIVATE_KEY=your_private_key
```

### Available Tasks

#### Lock Tokens
Lock DOGE tokens in the contract:
```bash
npx hardhat user-lock --amount <amount> --network testnet
```
- `amount`: Amount of DOGE to lock (e.g., 50)

#### Unlock Tokens
Unlock previously locked DOGE tokens:
```bash
npx hardhat user-unlock --amount <amount> --network testnet
```
- `amount`: Amount of DOGE to unlock (e.g., 50)

#### Bridge Tokens
Bridge DOGE tokens to another chain:
```bash
npx hardhat user-bridge --amount <amount> --network testnet
```
- `amount`: Amount of DOGE to bridge (e.g., 50)

#### Set Global Max Limit
Set the maximum total amount of DOGE that can be locked in the contract:
```bash
npx hardhat set-max-limit --amount <amount> --network testnet
```
- `amount`: Maximum total amount in DOGE (e.g., 1000000)

#### Set Personal Limits
Set the minimum and maximum amount of DOGE that each user can lock:
```bash
npx hardhat set-personal-limits --max <max_amount> --min <min_amount> --network testnet
```
- `max`: Maximum amount per user in DOGE (e.g., 500000)
- `min`: Minimum amount per user in DOGE (e.g., 50)

### Notes
- All amounts are in DOGE (will be automatically converted to the correct decimals)
- Tasks with `onlyOwner` functions require the deployer's private key
- Gas limits are preset but can be adjusted in the task code if needed
