import { LoggerInstance, LogLevel, makeAccounts, NeverminedOptions } from '@nevermined-io/sdk'

LoggerInstance.setLevel(LogLevel.Error)

const nograph = process.env['NO_GRAPH'] === 'true'

const configBase: NeverminedOptions = {
  web3ProviderUri: 'http://contracts.nevermined.localnet',
  marketplaceUri: 'http://marketplace.nevermined.localnet',
  neverminedNodeUri: process.env.NEVERMINED_NODE_URI || 'http://node.nevermined.localnet',
  neverminedNodeAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
  marketplaceAuthToken: 'bogus',
  artifactsFolder: './artifacts',
  circuitsFolder: './circuits',
  graphHttpUri: nograph
    ? undefined
    : 'http://localhost:9000/subgraphs/name/nevermined-io/development',
  gasMultiplier: 1.1,
  verbose: LogLevel.Error,
}

if (process.env.NETWORK_NAME === 'production') {
  Object.assign(configBase, {
    web3ProviderUri: 'http://contracts.nevermined.localnet',
    marketplaceUri: 'http://marketplace.nevermined.localnet',
    neverminedNodeUri: 'http://node.nevermined.localnet',
    neverminedNodeAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
  } as NeverminedOptions)
}

if (process.env.NETWORK_NAME === 'integration') {
  Object.assign(configBase, {
    web3ProviderUri: 'http://contracts.nevermined.localnet',
    marketplaceUri: 'http://marketplace.nevermined.localnet',
    neverminedNodeUri: 'http://node.nevermined.localnet',
    neverminedNodeAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
  } as NeverminedOptions)
}

if (process.env.NETWORK_NAME === 'testing') {
  Object.assign(configBase, {
    web3ProviderUri: 'http://contracts.nevermined.localnet',
    marketplaceUri: 'http://marketplace.nevermined.localnet',
    neverminedNodeUri: process.env.NEVERMINED_NODE_URI || 'http://node.nevermined.localnet',
    neverminedNodeAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
  } as NeverminedOptions)
}

if (process.env.NETWORK_NAME === 'rinkeby') {
  Object.assign(configBase, {
    marketplaceUri: 'https://metadata.rinkeby.nevermined.rocks',
    neverminedNodeUri: 'https://node.rinkeby.nevermined.rocks',
    web3ProviderUri: `https://rinkeby.infura.io/v3/52b6d403f7de4757ab9ed23c3778a35b`,
    neverminedNodeAddress: '0x068Ed00cF0441e4829D9784fCBe7b9e26D4BD8d0',
  } as NeverminedOptions)
}

if (process.env.NETWORK_NAME === 'mumbai') {
  Object.assign(configBase, {
    marketplaceUri: 'https://metadata.mumbai.nevermined.rocks',
    neverminedNodeUri: 'https://node.mumbai.nevermined.rocks',
    web3ProviderUri: `https://rpc-mumbai.maticvigil.com/v1/e145ac0424e2a2b3c340685c80a08e77099ce020`,
    neverminedNodeAddress: '0x068Ed00cF0441e4829D9784fCBe7b9e26D4BD8d0',
  } as NeverminedOptions)
}

if (process.env.SEED_WORDS) {
  configBase.accounts = makeAccounts(process.env.SEED_WORDS)
  // const seedphrase = process.env.SEED_WORDS

  // // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // // @ts-ignore
  // configBase.web3Provider = new HDWalletProvider(seedphrase, configBase.web3ProviderUri, 0, 10)
}

export const config: NeverminedOptions & { forceVerbose: NeverminedOptions } = configBase as any
;(config as any).forceVerbose = { ...configBase, verbose: true }

