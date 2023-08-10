import { assert } from 'chai'
import { config } from './config'
import {
  Nevermined,
  Keeper,
  Account,
  Logger,
  EscrowPaymentCondition,
  LockPaymentCondition,
  generateId,
  Token,
  BabyjubPublicKey,
  generateIntantiableConfigFromConfig,
  ConditionInstanceSmall,
} from '@nevermined-io/sdk'
import {
  Dtp,
  AccessDLEQCondition,
  KeyTransfer,
  makeKeyTransfer,
  AccessDLEQTemplate,
  dleq,
} from '../src'
import { cryptoConfig } from './utils'

describe('Register Escrow Access DLEQ Template (fulfillment by network)', () => {
  let nevermined: Nevermined
  let keeper: Keeper

  let accessTemplate: AccessDLEQTemplate

  const url = 'https://example.com/did/nevermined/test-attr-example.txt'
  const checksum = 'b'.repeat(64)
  const totalAmount = 12n
  const amounts = [10n, 2n]

  let templateManagerOwner: Account
  let publisher: Account
  let consumer: Account
  let provider: Account
  let receivers: string[]

  let accessCondition: AccessDLEQCondition
  let lockPaymentCondition: LockPaymentCondition
  let escrowPaymentCondition: EscrowPaymentCondition
  let token: Token
  let dtp: Dtp

  before(async () => {
    nevermined = await Nevermined.getInstance(config)

    const instanceConfig = {
      ...(await generateIntantiableConfigFromConfig(config)),
      nevermined,
    }

    dtp = await Dtp.getInstance(instanceConfig, cryptoConfig)
    ;({ keeper } = nevermined)
    accessTemplate = dtp.accessDLEQTemplate
    ;({ token } = keeper)

    // Accounts
    ;[templateManagerOwner, publisher, consumer, provider] = await nevermined.accounts.list()

    receivers = [publisher.getId(), provider.getId()]

    // Conditions
    accessCondition = dtp.accessDLEQCondition
    ;({ lockPaymentCondition, escrowPaymentCondition } = keeper.conditions)
  })

  describe('Propose and approve template', () => {
    it('should propose the template', async () => {
      await keeper.templateStoreManager.proposeTemplate(accessTemplate.address, consumer, true)
      // TODO: Use a event to detect template mined
      await new Promise((resolve) => setTimeout(resolve, 2 * 1000))
    })

    it('should approve the template', async () => {
      await keeper.templateStoreManager.approveTemplate(
        accessTemplate.address,
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
    let buyerPub: BabyjubPublicKey
    let providerPub: BabyjubPublicKey
    let keyTransfer: KeyTransfer

    let secret: string
    let secretId: BabyjubPublicKey
    const passwd = 123456n
    let encryptedPasswd: bigint
    let cipher: string
    let instances: ConditionInstanceSmall[]

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
      secret = keyTransfer.makeKey('abcedf'+Math.random())
      buyerPub = await dleq.secretToPublic(buyerK)
      providerPub = await accessCondition.networkKey()      
      secretId = await dleq.secretToPublic(secret)
      encryptedPasswd = await dleq.encrypt(passwd, secret, providerPub)
      cipher = dleq.bigToHex(encryptedPasswd)
    })

    it('should configure secret', async () => {
      await accessCondition.addSecret(secretId, publisher)
      const pid = await accessCondition.pointId(secretId)
      await accessCondition.addPrice(pid, 1n, token.address, 20, publisher)
    })

    it('should register a DID', async () => {
      await keeper.didRegistry.registerAttribute(didSeed, checksum, [], url, publisher.getId())
    })

    it('should generate the condition IDs', async () => {
      conditionIdAccess = await accessCondition.generateIdWithSeed(
        agreementId,
        await accessCondition.hashValues(cipher, secretId, providerPub, buyerPub),
      )
      conditionIdLock = await lockPaymentCondition.generateIdWithSeed(
        agreementId,
        await lockPaymentCondition.hashValues(
          did,
          escrowPaymentCondition.address,
          token.address,
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
          escrowPaymentCondition.address,
          token.address,
          conditionIdLock[1],
          conditionIdAccess[1],
        ),
      )
      const i1 = await accessCondition.instance(agreementId, accessCondition.params(cipher, secretId, providerPub, buyerPub))
      const i2 = await lockPaymentCondition.instance(agreementId, lockPaymentCondition.params(
        did,
        escrowPaymentCondition.address,
        token.address,
        amounts,
        receivers,
      ))
      const i3 = await escrowPaymentCondition.instance(agreementId, escrowPaymentCondition.params(
        did,
        amounts,
        receivers,
        consumer.getId(),
        escrowPaymentCondition.address,
        token.address,
        conditionIdLock[1],
        conditionIdAccess[1],
      ))
      instances = [i1, i2, i3]
    })

    it('should have conditions types', async () => {
      const conditionTypes = await accessTemplate.getConditionTypes()

      assert.equal(conditionTypes.length, 3, 'Expected 3 conditions.')
      assert.deepEqual(
        [...conditionTypes].sort(),
        [
          accessCondition.address,
          escrowPaymentCondition.address,
          lockPaymentCondition.address,
        ].sort(),
        "The conditions doesn't match",
      )
    })

    it('should have condition instances associated', async () => {
      const conditionInstances = await accessTemplate.getConditions()

      assert.equal(conditionInstances.length, 3, 'Expected 3 conditions.')

      const conditionClasses = [AccessDLEQCondition, EscrowPaymentCondition, LockPaymentCondition]
      conditionClasses.forEach((conditionClass) => {
        if (!conditionInstances.find((condition) => condition instanceof conditionClass)) {
          throw new Error(`${conditionClass.name} is not part of the conditions.`)
        }
      })
    })

    it('should create a new agreement', async () => {
      const agreement = await accessTemplate.createAgreement(
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

      await keeper.token.approve(lockPaymentCondition.address, totalAmount, consumer)

      const fulfill = await lockPaymentCondition.fulfill(
        agreementId,
        did,
        escrowPaymentCondition.address,
        token.address,
        amounts,
        receivers,
        consumer,
      )
      assert.isDefined(fulfill.logs[0], 'Not Fulfilled event.')      
    })

    it('should fulfill AccessCondition', async () => {
      const register = await accessCondition.authorize(agreementId, instances, 0, consumer)
      assert.isDefined(register.events![0], 'Not Fulfilled event.')

      await new Promise((resolve) => setTimeout(resolve, 20 * 1000))
    })

    it('should fulfill EscrowPaymentCondition', async () => {
      const fulfill = await escrowPaymentCondition.fulfill(
        agreementId,
        did,
        amounts,
        receivers,
        consumer.getId(),
        escrowPaymentCondition.address,
        token.address,
        conditionIdLock[1],
        conditionIdAccess[1],
        consumer,
      )
      assert.isDefined(fulfill.logs[0], 'Not Fulfilled event.')      
    })
  })

})
