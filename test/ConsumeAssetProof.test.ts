import {
  Nevermined,
  Account,
  DDO,
  MetaData,
  Logger,
  BabyjubPublicKey,
  AssetAttributes,
  generateIntantiableConfigFromConfig,
} from '@nevermined-io/nevermined-sdk-js'
import { assert } from 'chai'
import { decodeJwt } from 'jose'
import { Dtp } from '../src/Dtp'
import { makeKeyTransfer } from '../src/KeyTransfer'
import { config } from './config'
import { cryptoConfig, getMetadataForDTP, sleep } from './utils'

describe('Consume Asset (Node w/ proofs)', () => {
  let nevermined: Nevermined
  let keyTransfer
  let dtp: Dtp

  let publisher: Account
  let consumer: Account

  let ddo: DDO
  let agreementId: string

  const providerKey = {
    x: '0x2e3133fbdaeb5486b665ba78c0e7e749700a5c32b1998ae14f7d1532972602bb',
    y: '0x0b932f02e59f90cdd761d9d5e7c15c8e620efce4ce018bf54015d68d9cb35561',
  }

  const origPasswd = Buffer.from('passwd_32_letters_1234567890asdF').toString('hex')

  let metadata: MetaData

  before(async () => {
    nevermined = await Nevermined.getInstance(config)
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined,
    }

    dtp = await Dtp.getInstance(instanceConfig, cryptoConfig)
    keyTransfer = await makeKeyTransfer()

    // Accounts
    ;[publisher, consumer] = await nevermined.accounts.list()

    const clientAssertion = await nevermined.utils.jwt.generateClientAssertion(publisher)

    await nevermined.services.marketplace.login(clientAssertion)
    const payload = decodeJwt(config.marketplaceAuthToken!)

    consumer.babyX = '0x0d7cdd240c2f5b0640839c49fbaaf016a8c5571b8f592e2b62ea939063545981'
    consumer.babyY = '0x14b14fa0a30ec744dde9f32d519c65ebaa749bfe991a32deea44b83a4e5c65bb'
    consumer.babySecret = 'abd'

    metadata = await getMetadataForDTP('foo' + Math.random(), origPasswd, providerKey)

    metadata.userId = payload.sub

    const assetAttributes = AssetAttributes.getInstance({
      metadata,
    })

    ddo = await nevermined.assets.create(assetAttributes, publisher)

    assert.instanceOf(ddo, DDO)
  })

  after(() => {
    try {
      localStorage.clear()
    } catch (error) {
      Logger.error(error)
    }
  })

  it('should fetch the RSA publicKey from the node', async () => {
    const rsaPublicKey = await nevermined.services.node.getRsaPublicKey()
    assert.isDefined(rsaPublicKey)
  })

  it('should agreement id be defined', async () => {
    try {
      await consumer.requestTokens(
        +ddo.getPriceByService() * 10 ** -(await nevermined.keeper.token.decimals()),
      )
    } catch (error) {
      Logger.error(error)
    }

    const steps: any[] = []
    agreementId = await nevermined.assets.order(ddo.id, consumer).next((step) => steps.push(step))

    assert.isDefined(agreementId)
  })

  it('should consume and store the assets', async () => {
    const passwd = await dtp.consumeProof(agreementId, ddo.id, consumer)
    assert.deepEqual(passwd, origPasswd)
  })

  it('buyer should have the key', async () => {
    // wait for subgraph to pick up the events
    await sleep(3000)
    const key = await dtp.readKey(
      agreementId,
      keyTransfer.makeKey(consumer.babySecret),
      new BabyjubPublicKey(providerKey.x, providerKey.y),
    )
    assert.equal(key.toString('hex'), origPasswd)
  })
})
