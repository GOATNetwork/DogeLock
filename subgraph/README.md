```shell
npm run start-local-node

npm run deploy-contracts

cd subgraph
docker-compose down
rm -rf ../.data
docker-compose up -d
cd ..

npm run prepare-subgraph
npm run codegen

npm run build-subgraph

npm run remove-local-subgraph
npm run create-local-subgraph
npm run deploy-local-subgraph

npx hardhat create-test-data --network localhost
```
docker logs -f subgraph-graph-node-1
```
8
url: 'https://rpc.testnet.goat.network',
chainId: 48815,

deployerAddr : 0x3C742E1E21FF8d4E37D858Eb5B9aBFc66EB5EbC4
-----Chain A-----
Mock TokenA: 0x816697B129eC814f455C553a0c5C4C7A0bA478a2
Mock EndpointA: 0xBA3c99376FeEe6c44656a35B6B16DB5585327843
Doge Lock: 0xE9A313ac1e8A1994E2Ac0a9128e776b6532D20E8
-----Chain B-----
Mock TokenA: 0xBd2bEc8475079DC064305e5350e8c3afA1d9A715
Mock EndpointA: 0x83c5228d7DA77F746Fb5Ab5b689F7b0787a79765
Doge Lock: 0xa4c25F7016e00b3A2bD0a127BCA8E0523B4E3b56
```
