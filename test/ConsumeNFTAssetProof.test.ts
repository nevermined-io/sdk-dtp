import { Nevermined, Account, DDO, MetaData } from '@nevermined-io/nevermined-sdk-js'
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import { ConditionInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions'
import { NFTUpgradeable } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions/NFTs/NFTUpgradable'
import { BabyjubPublicKey } from '@nevermined-io/nevermined-sdk-js/dist/node/models/KeyTransfer'
import { generateId, zeroX } from '@nevermined-io/nevermined-sdk-js/dist/node/utils'
import { assert } from 'chai'
import { decodeJwt } from 'jose'
import { Dtp } from '../src/Dtp'
import { makeKeyTransfer } from '../src/KeyTransfer'
import { NFTAccessProofTemplate } from '../src/NFTAccessProofTemplate'
import { config } from './config'
import { getMetadataForDTP, sleep } from './utils'

describe('Consume NFT Asset (Gateway w/ proofs)', () => {
  let nevermined: Nevermined
  let keyTransfer
  let dtp: Dtp

  let publisher: Account
  let consumer: Account
  let token: NFTUpgradeable

  let ddo: DDO
  let agreementId: string
  let template: NFTAccessProofTemplate

  const providerKey = {
    x: '0x2e3133fbdaeb5486b665ba78c0e7e749700a5c32b1998ae14f7d1532972602bb',
    y: '0x0b932f02e59f90cdd761d9d5e7c15c8e620efce4ce018bf54015d68d9cb35561'
  }

  const origPasswd = Buffer.from('passwd_32_letters_1234567890asdF').toString('hex')

  let metadata: MetaData
  before(async () => {
    // config.graphHttpUri = undefined
    nevermined = await Nevermined.getInstance(config)
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined
    }

    dtp = await Dtp.getInstance(instanceConfig)
    keyTransfer = await makeKeyTransfer()
    template = dtp.nftAccessProofTemplate
    token = nevermined.keeper.nftUpgradeable

    // Accounts
    ;[publisher, consumer] = await nevermined.accounts.list()

    // console.log(publisher)

    const clientAssertion = await nevermined.utils.jwt.generateClientAssertion(publisher)

    await nevermined.marketplace.login(clientAssertion)
    const payload = decodeJwt(config.marketplaceAuthToken)

    consumer.babyX = '0x0d7cdd240c2f5b0640839c49fbaaf016a8c5571b8f592e2b62ea939063545981'
    consumer.babyY = '0x14b14fa0a30ec744dde9f32d519c65ebaa749bfe991a32deea44b83a4e5c65bb'
    consumer.babySecret = 'abd'

    metadata = await getMetadataForDTP('foo' + Math.random(), origPasswd, providerKey)

    metadata.userId = payload.sub
  })

  after(() => {
    try {
      localStorage.clear()
    } catch {}
  })

  it('should fetch the RSA publicKey from the gateway', async () => {
    const rsaPublicKey = await nevermined.gateway.getRsaPublicKey()
    assert.isDefined(rsaPublicKey)
  })

  it('should authenticate the accounts', async () => {
    await publisher.authenticate()
    await consumer.authenticate()
  })

  it('should register an asset', async () => {
    ddo = await nevermined.assets.createNft(metadata, publisher, undefined, undefined, 
      100,
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      ['nft-access-proof']
    )

    await token.transferNft(ddo.id, consumer.getId(), 10, publisher.getId())

    assert.instanceOf(ddo, DDO)
  })

  it('should order the asset', async () => {
    const agreementIdSeed = zeroX(generateId())
    const params = template.params(consumer, consumer.getId(), 1)
    console.log(consumer.getId())
    agreementId = await template.createAgreementFromDDO(
      agreementIdSeed,
      ddo,
      params,
      consumer,
      consumer,
    )
    const agreementData = await template.instanceFromDDO(
      agreementIdSeed,
      ddo,
      consumer.getId(),
      params
    )
    await nevermined.keeper.conditions.nftHolderCondition.fulfillInstance(agreementData.instances[0] as ConditionInstance<{}>, {}, consumer)
    console.log(agreementData.instances.map(a => a.id))
  })

  it('should consume and store the assets', async () => {
    const passwd = await dtp.consumeProof(agreementId, ddo.id, consumer, 'nft-access-proof')
    assert.deepEqual(passwd, origPasswd)
  })

  it('buyer should have the key', async () => {
    // wait for subgraph to pick up the events
    await sleep(3000)
    const key = await dtp.readKey(
      agreementId,
      keyTransfer.makeKey(consumer.babySecret),
      new BabyjubPublicKey(providerKey.x, providerKey.y)
    )
    assert.equal(key.toString('hex'), origPasswd)
  })
})
