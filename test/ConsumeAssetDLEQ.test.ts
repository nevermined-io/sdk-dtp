import {
  Nevermined,
  Account,
  DDO,
  MetaData,
  Logger,
  BabyjubPublicKey,
  AssetAttributes,
  generateIntantiableConfigFromConfig,
} from '@nevermined-io/sdk'
import { assert } from 'chai'
import { decodeJwt } from 'jose'
import { Dtp, KeyTransfer, dleq, makeKeyTransfer } from '../src'
import { config } from './config'
import { cryptoConfig, getMetadataForDLEQ, sleep } from './utils'

describe.skip('Consume Asset (Node w/ DLEQ proofs)', () => {
  let nevermined: Nevermined
  let dtp: Dtp

  let publisher: Account
  let consumer: Account

  let ddo: DDO
  let agreementId: string

  let buyerK: string
  let providerK: string
  let buyerPub: BabyjubPublicKey
  let providerPub: BabyjubPublicKey
  let keyTransfer: KeyTransfer

  let secret: string
  let secretId: BabyjubPublicKey
  let passwd: bigint
  let encryptedPasswd: bigint
  let cipher: string

  const origPasswd = 'passwd_32_letters_1234567890asdf'

  let metadata: MetaData

  before(async () => {
    nevermined = await Nevermined.getInstance(config)
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined,
    }

    dtp = await Dtp.getInstance(instanceConfig, cryptoConfig)
    keyTransfer = await makeKeyTransfer()

    buyerK = keyTransfer.makeKey('abd')
    providerK = keyTransfer.makeKey('abc_def')
    secret = keyTransfer.makeKey('abcedf')
    buyerPub = await dleq.secretToPublic(buyerK)
    providerPub = await dleq.secretToPublic(providerK)
    secretId = await dleq.secretToPublic(secret)
    passwd = dleq.makeKey(origPasswd)
    encryptedPasswd = await dleq.encrypt(passwd, secret, providerPub)
    cipher = dleq.bigToHex(encryptedPasswd)

    // Accounts
    ;[publisher, consumer] = await nevermined.accounts.list()

    const clientAssertion = await nevermined.utils.jwt.generateClientAssertion(publisher)

    await nevermined.services.marketplace.login(clientAssertion)
    const payload = decodeJwt(config.marketplaceAuthToken!)

    consumer.babyX = buyerPub.x
    consumer.babyY = buyerPub.y
    consumer.babySecret = buyerK

    metadata = await getMetadataForDLEQ('foo' + Math.random(), cipher, providerPub, secretId)

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
    const res_passwd = await dtp.consumeProof(agreementId, ddo.id, consumer)
    assert.deepEqual(res_passwd, cipher)
  })

  it('buyer should have the key', async () => {
    // wait for subgraph to pick up the events
    await sleep(3000)
    const key = await dtp.readKeyDLEQ(agreementId, cipher, buyerK, providerPub)
    assert.equal(key.toString(16), passwd.toString(16))
  })
})
