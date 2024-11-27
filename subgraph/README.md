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
