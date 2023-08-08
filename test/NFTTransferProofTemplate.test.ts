import { assert } from 'chai'
import { decodeJwt } from 'jose'
import { config } from './config'
import {
  Nevermined,
  Account,
  DDO,
  Logger,
  Token,
  LockPaymentCondition,
  AssetPrice,
  AgreementInstance,
  ConditionInstance,
  NFTAttributes,
  Nft1155Contract,
  BabyjubPublicKey,
  generateId,
  generateIntantiableConfigFromConfig,
} from '@nevermined-io/sdk'
import {
  Dtp,
  AccessProofConditionExtra,
  KeyTransfer,
  makeKeyTransfer,
  NFTSalesWithAccessTemplate,
  NFTSalesWithAccessTemplateParams,
} from '../src'
import { cryptoConfig, getMetadataForDTP } from './utils'

describe('NFT Transfer Proof Template', () => {
  let nevermined: Nevermined

  let accessProofTemplate: NFTSalesWithAccessTemplate
  let lockPaymentCondition: LockPaymentCondition
  let nftContract: Nft1155Contract

  const totalAmount = 12n
  const amounts = [10n, 2n]

  let publisher: Account
  let consumer: Account
  let provider: Account
  let receivers: string[]

  let dtp: Dtp

  before(async () => {
    nevermined = await Nevermined.getInstance(config)

    const instanceConfig = {
      ...(await generateIntantiableConfigFromConfig(config)),
      nevermined,
    }

    dtp = await Dtp.getInstance(instanceConfig, cryptoConfig)
    accessProofTemplate = dtp.nftSalesWithAccessTemplate
    ;({ lockPaymentCondition } = nevermined.keeper.conditions)

    // Accounts
    ;[, publisher, consumer, provider] = await nevermined.accounts.list()

    receivers = [publisher.getId(), provider.getId()]
  })

  describe('Short flow', () => {
    let agreementId, agreementIdSeed: string
    let ddo: DDO

    let buyerK: string
    let providerK: string
    let buyerPub: BabyjubPublicKey
    let providerPub: BabyjubPublicKey
    let keyTransfer: KeyTransfer
    let token: Token

    let agreementData: AgreementInstance<NFTSalesWithAccessTemplateParams>

    const providerKey = {
      x: '0x2e3133fbdaeb5486b665ba78c0e7e749700a5c32b1998ae14f7d1532972602bb',
      y: '0x0b932f02e59f90cdd761d9d5e7c15c8e620efce4ce018bf54015d68d9cb35561',
    }

    const origPasswd = 'passwd_32_letters_1234567890asdf'
    const data = Buffer.from(origPasswd)

    let metadata

    before(async () => {
      metadata = await getMetadataForDTP('foo' + Math.random(), data.toString('hex'), providerKey)
      ;({ token, nftUpgradeable: nftContract } = nevermined.keeper)

      const clientAssertion = await nevermined.utils.jwt.generateClientAssertion(publisher)

      await nevermined.services.marketplace.login(clientAssertion)

      const payload = decodeJwt(config.marketplaceAuthToken!)
      metadata.userId = payload.sub

      const assetPrice = new AssetPrice(
        new Map([
          [receivers[0], amounts[0]],
          [receivers[1], amounts[1]],
        ]),
      )
      agreementIdSeed = generateId()

      const nftAttributes = NFTAttributes.getNFT1155Instance({
        metadata,
        services: [
          {
            serviceType: 'nft-sales-proof',
            price: assetPrice,
            nft: { amount: 20n, nftTransfer: false }
          },
          {
            serviceType: 'nft-access',
          },
        ],           
        nftContractAddress: nftContract.address,
        cap: 100n,
        preMint: false
      })
      ddo = await nevermined.nfts1155.create(nftAttributes, publisher)

      keyTransfer = await makeKeyTransfer()
      buyerK = await keyTransfer.makeKey('abd')
      buyerPub = await keyTransfer.secretToPublic(buyerK)
      providerK = await keyTransfer.makeKey('abc')
      providerPub = await keyTransfer.secretToPublic(providerK)
      consumer.babyX = buyerPub.x
      consumer.babyY = buyerPub.y
      consumer.babySecret = buyerK
    })

    it('should create a new agreement (short way)', async () => {
      const params = accessProofTemplate.params(consumer, publisher.getId(), 1n)
      agreementId = await accessProofTemplate.createAgreementFromDDO(
        agreementIdSeed,
        ddo,
        params,
        consumer,
        publisher,
      )
      agreementData = await accessProofTemplate.instanceFromDDO(
        agreementIdSeed,
        ddo,
        publisher.getId(),
        params,
      )

      assert.match(agreementId, /^0x[a-f0-9]{64}$/i)
    })

    it('should fulfill the conditions from consumer side', async () => {
      try {
        await consumer.requestTokens(totalAmount)
      } catch (error) {
        Logger.error(error)
      }

      await token.approve(lockPaymentCondition.address, totalAmount, consumer)
      await lockPaymentCondition.fulfillInstance(
        agreementData.instances[0] as ConditionInstance<any>,
        {},
        consumer,
      )
    })

    it('should fulfill the conditions from publisher side', async () => {
      const extra: AccessProofConditionExtra = {
        providerK,
        data,
      }
      await nevermined.keeper.conditions.transferNftCondition.fulfillInstance(
        agreementData.instances[1] as ConditionInstance<any>,
        {},
        publisher,
      )
      await dtp.accessProofCondition.fulfillInstance(
        agreementData.instances[3] as ConditionInstance<AccessProofConditionExtra>,
        extra,
      )
      await nevermined.keeper.conditions.escrowPaymentCondition.fulfillInstance(
        agreementData.instances[2] as ConditionInstance<any>,
        {},
      )
    })

    it('buyer should have the key', async () => {
      const key = await dtp.readKey(agreementId, buyerK, providerPub)
      assert.equal(key.toString(), data.toString())
    })
  })
})
