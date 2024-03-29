import { assert } from 'chai'
import { decodeJwt } from 'jose'
import { config } from './config'
import {
  Nevermined,
  Keeper,
  Account,
  DDO,
  Logger,
  AssetPrice,
  AssetAttributes,
  EscrowPaymentCondition,
  LockPaymentCondition,
  generateId,
  Token,
  BabyjubPublicKey,
  BigNumber,
  generateIntantiableConfigFromConfig,
} from '@nevermined-io/sdk'
import {
  Dtp,
  AccessProofCondition,
  KeyTransfer,
  makeKeyTransfer,
  AccessProofTemplate,
} from '../src'
import { cryptoConfig, getMetadataForDTP } from './utils'

describe('Register Escrow Access Proof Template', () => {
  let nevermined: Nevermined
  let keeper: Keeper

  let accessProofTemplate: AccessProofTemplate

  const url = 'https://example.com/did/nevermined/test-attr-example.txt'
  const checksum = 'b'.repeat(64)
  const totalAmount = BigNumber.from(12)
  const amounts = [BigNumber.from(10), BigNumber.from(2)]

  let templateManagerOwner: Account
  let publisher: Account
  let consumer: Account
  let provider: Account
  let receivers: string[]

  let accessProofCondition: AccessProofCondition
  let lockPaymentCondition: LockPaymentCondition
  let escrowPaymentCondition: EscrowPaymentCondition
  let token: Token
  let dtp: Dtp

  before(async () => {
    nevermined = await Nevermined.getInstance(config)

    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined,
    }

    dtp = await Dtp.getInstance(instanceConfig, cryptoConfig)
    ;({ keeper } = nevermined)
    accessProofTemplate = dtp.accessProofTemplate
    ;({ token } = keeper)

    // Accounts
    ;[templateManagerOwner, publisher, consumer, provider] = await nevermined.accounts.list()

    receivers = [publisher.getId(), provider.getId()]

    // Conditions
    accessProofCondition = dtp.accessProofCondition
    ;({ lockPaymentCondition, escrowPaymentCondition } = keeper.conditions)
  })

  describe('Propose and approve template', () => {
    it('should propose the template', async () => {
      await keeper.templateStoreManager.proposeTemplate(
        accessProofTemplate.getAddress(),
        consumer,
        true,
      )
      // TODO: Use a event to detect template mined
      await new Promise((resolve) => setTimeout(resolve, 2 * 1000))
    })

    it('should approve the template', async () => {
      await keeper.templateStoreManager.approveTemplate(
        accessProofTemplate.getAddress(),
        templateManagerOwner,
        true,
      )
      // TODO: Use a event to detect template mined
      await new Promise((resolve) => setTimeout(resolve, 2 * 1000))
    })
  })

  describe('Full flow', () => {
    let agreementId: string
    let agreementIdSeed: string
    let didSeed: string
    let did: string

    let conditionIdAccess: [string, string]
    let conditionIdLock: [string, string]
    let conditionIdEscrow: [string, string]

    let buyerK: string
    let providerK: string
    let buyerPub: BabyjubPublicKey
    let providerPub: BabyjubPublicKey
    let keyTransfer: KeyTransfer

    const data = Buffer.from(
      '4e657665726d696e65640a436f707972696768742032303230204b65796b6f20476d62482e0a0a546869732070726f6475637420696e636c75646573',
      'hex',
    )
    let hash: string

    before(async () => {
      agreementIdSeed = generateId()
      agreementId = await nevermined.keeper.agreementStoreManager.agreementId(
        agreementIdSeed,
        publisher.getId(),
      )
      didSeed = generateId()
      did = await keeper.didRegistry.hashDID(didSeed, publisher.getId())

      keyTransfer = await makeKeyTransfer()

      buyerK = keyTransfer.makeKey('abd')
      providerK = keyTransfer.makeKey('abc')
      buyerPub = await keyTransfer.secretToPublic(buyerK)
      providerPub = await keyTransfer.secretToPublic(providerK)
      hash = await keyTransfer.hashKey(data)
    })

    it('should register a DID', async () => {
      await keeper.didRegistry.registerAttribute(didSeed, checksum, [], url, publisher.getId())
    })

    it('should generate the condition IDs', async () => {
      conditionIdAccess = await accessProofCondition.generateIdWithSeed(
        agreementId,
        await accessProofCondition.hashValues(hash, buyerPub, providerPub),
      )
      conditionIdLock = await lockPaymentCondition.generateIdWithSeed(
        agreementId,
        await lockPaymentCondition.hashValues(
          did,
          escrowPaymentCondition.getAddress(),
          token.getAddress(),
          amounts,
          receivers,
        ),
      )
      conditionIdEscrow = await escrowPaymentCondition.generateIdWithSeed(
        agreementId,
        await escrowPaymentCondition.hashValues(
          did,
          amounts,
          receivers,
          consumer.getId(),
          escrowPaymentCondition.getAddress(),
          token.getAddress(),
          conditionIdLock[1],
          conditionIdAccess[1],
        ),
      )
    })

    it('should have conditions types', async () => {
      const conditionTypes = await accessProofTemplate.getConditionTypes()

      assert.equal(conditionTypes.length, 3, 'Expected 3 conditions.')
      assert.deepEqual(
        [...conditionTypes].sort(),
        [
          accessProofCondition.getAddress(),
          escrowPaymentCondition.getAddress(),
          lockPaymentCondition.getAddress(),
        ].sort(),
        "The conditions doesn't match",
      )
    })

    it('should have condition instances associated', async () => {
      const conditionInstances = await accessProofTemplate.getConditions()

      assert.equal(conditionInstances.length, 3, 'Expected 3 conditions.')

      const conditionClasses = [AccessProofCondition, EscrowPaymentCondition, LockPaymentCondition]
      conditionClasses.forEach((conditionClass) => {
        if (!conditionInstances.find((condition) => condition instanceof conditionClass)) {
          throw new Error(`${conditionClass.name} is not part of the conditions.`)
        }
      })
    })

    it('should create a new agreement', async () => {
      const agreement = await accessProofTemplate.createAgreement(
        agreementIdSeed,
        did,
        [conditionIdAccess[0], conditionIdLock[0], conditionIdEscrow[0]],
        [0, 0, 0],
        [0, 0, 0],
        [consumer.getId()],
        publisher,
      )

      assert.isTrue(agreement.status === 1)
    })

    it('should fulfill LockPaymentCondition', async () => {
      try {
        await consumer.requestTokens(totalAmount)
      } catch (error) {
        Logger.error(error)
      }

      await keeper.token.approve(lockPaymentCondition.getAddress(), totalAmount, consumer)

      const fulfill = await lockPaymentCondition.fulfill(
        agreementId,
        did,
        escrowPaymentCondition.getAddress(),
        token.getAddress(),
        amounts,
        receivers,
        consumer,
      )

      assert.isDefined(fulfill.events![0], 'Not Fulfilled event.')
    })

    it('should fulfill AccessCondition', async () => {
      const cipher = await keyTransfer.encryptKey(data, await keyTransfer.ecdh(providerK, buyerPub))
      const proof = await keyTransfer.prove(buyerPub, providerPub, providerK, data, config)
      const fulfill = await accessProofCondition.fulfill(
        agreementId,
        hash,
        buyerPub,
        providerPub,
        cipher,
        proof,
      )

      assert.isDefined(fulfill.events![0], 'Not Fulfilled event.')
    })

    it('should fulfill EscrowPaymentCondition', async () => {
      const fulfill = await escrowPaymentCondition.fulfill(
        agreementId,
        did,
        amounts,
        receivers,
        consumer.getId(),
        escrowPaymentCondition.getAddress(),
        token.getAddress(),
        conditionIdLock[1],
        conditionIdAccess[1],
        consumer,
      )

      assert.isDefined(fulfill.events![0], 'Not Fulfilled event.')
    })
  })

  describe('Short flow', () => {
    let agreementId: string
    let ddo: DDO

    let buyerK: string
    let providerK: string
    let buyerPub: BabyjubPublicKey
    let providerPub: BabyjubPublicKey
    let keyTransfer: KeyTransfer

    const providerKey = {
      x: '0x2e3133fbdaeb5486b665ba78c0e7e749700a5c32b1998ae14f7d1532972602bb',
      y: '0x0b932f02e59f90cdd761d9d5e7c15c8e620efce4ce018bf54015d68d9cb35561',
    }

    const origPasswd = 'passwd_32_letters_1234567890asdf'
    const data = Buffer.from(origPasswd)

    let metadata

    before(async () => {
      metadata = await getMetadataForDTP('foo' + Math.random(), data.toString('hex'), providerKey)

      const clientAssertion = await nevermined.utils.jwt.generateClientAssertion(publisher)

      await nevermined.services.marketplace.login(clientAssertion)

      const payload = decodeJwt(config.marketplaceAuthToken as string)
      metadata.userId = payload.sub

      const assetPrice = new AssetPrice(
        new Map([
          [receivers[0], amounts[0]],
          [receivers[1], amounts[1]],
        ]),
      )

      const assetAttributes = AssetAttributes.getInstance({
        metadata,
        price: assetPrice,
        serviceTypes: ['access'],
      })
      ddo = await nevermined.assets.create(assetAttributes, publisher)

      // ddo = await nevermined.assets.create(metadata, publisher, assetPrice, ['access'])
      keyTransfer = await makeKeyTransfer()
      buyerK = await keyTransfer.makeKey('abd')
      providerK = await keyTransfer.makeKey('abc')
      buyerPub = await keyTransfer.secretToPublic(buyerK)
      providerPub = await keyTransfer.secretToPublic(providerK)
      consumer.babyX = buyerPub.x
      consumer.babyY = buyerPub.y
      consumer.babySecret = buyerK
    })

    it('should create a new agreement (short way)', async () => {
      agreementId = await accessProofTemplate.createAgreementFromDDO(
        generateId(),
        ddo,
        accessProofTemplate.params(consumer),
        consumer,
        publisher,
      )

      assert.match(agreementId, /^0x[a-f0-9]{64}$/i)
    })

    it('should fulfill the conditions from consumer side', async () => {
      try {
        await consumer.requestTokens(totalAmount)
      } catch (error) {
        Logger.error(error)
      }

      await nevermined.agreements.conditions.lockPayment(
        agreementId,
        ddo.shortId(),
        amounts,
        receivers,
        token.getAddress(),
        consumer,
      )
    })

    it('should fulfill the conditions from publisher side', async () => {
      await dtp.transferKey(agreementId, data, providerK, buyerPub, providerPub, publisher)
      await nevermined.agreements.conditions.releaseReward(
        agreementId,
        amounts,
        receivers,
        consumer.getId(),
        ddo.shortId(),
        token.getAddress(),
        publisher,
      )
    })

    it('buyer should have the key', async () => {
      const key = await dtp.readKey(agreementId, buyerK, providerPub)
      assert.equal(key.toString(), data.toString())
    })
  })
})
