import { assert } from 'chai'
import { decodeJwt } from 'jose'
import { config } from './config'
import { Nevermined, Account, DDO, Logger, Token, NFTAttributes } from '@nevermined-io/nevermined-sdk-js'
import { BabyjubPublicKey } from '@nevermined-io/nevermined-sdk-js/dist/node/models/KeyTransfer'
import { Dtp } from '../src/Dtp'
import { KeyTransfer, makeKeyTransfer } from '../src/KeyTransfer'
import { cryptoConfig, getMetadataForDTP } from './utils'
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import BigNumber from '@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber'
import { LockPaymentCondition } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions'

describe('NFT Transfer w/ node Template', () => {
  let nevermined: Nevermined

  let lockPaymentCondition: LockPaymentCondition

  const totalAmount = BigNumber.from(12)

  let publisher: Account
  let consumer: Account

  let dtp: Dtp

  before(async () => {
    nevermined = await Nevermined.getInstance(config)

    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined,
    }

    dtp = await Dtp.getInstance(instanceConfig, cryptoConfig);
    ({ lockPaymentCondition } = nevermined.keeper.conditions);

    // Accounts
    [, publisher, consumer] = await nevermined.accounts.list()

  })

  describe('Short flow', () => {
    let agreementId: string
    let ddo: DDO

    let buyerK: string
    let providerK: string
    let buyerPub: BabyjubPublicKey
    let providerPub: BabyjubPublicKey
    let keyTransfer: KeyTransfer
    let token: Token

    const providerKey = {
      x: '0x2e3133fbdaeb5486b665ba78c0e7e749700a5c32b1998ae14f7d1532972602bb',
      y: '0x0b932f02e59f90cdd761d9d5e7c15c8e620efce4ce018bf54015d68d9cb35561',
    }

    const origPasswd = 'passwd_32_letters_1234567890asdf'
    const data = Buffer.from(origPasswd)

    let metadata

    before(async () => {
      metadata = await getMetadataForDTP('foo' + Math.random(), data.toString('hex'), providerKey);
      ({ token } = nevermined.keeper)

      const clientAssertion = await nevermined.utils.jwt.generateClientAssertion(publisher)

      await nevermined.services.marketplace.login(clientAssertion)
      const payload = decodeJwt(config.marketplaceAuthToken!)
      metadata.userId = payload.sub

      const nftAttributes = NFTAttributes.getNFT1155Instance({
        metadata,
        serviceTypes: ['nft-access', 'nft-sales-proof'],
        nftContractAddress: token.address,
        cap: BigNumber.from(100),
        amount: BigNumber.from(1),
      })
      ddo = await nevermined.nfts1155.create(nftAttributes, publisher)
      
      keyTransfer = await makeKeyTransfer()
      buyerK = await keyTransfer.makeKey('abd')
      buyerPub = await keyTransfer.secretToPublic(buyerK)
      providerK = await keyTransfer.makeKey('abc')
      providerPub = await keyTransfer.secretToPublic(providerK)
      consumer.babyX = buyerPub.x
      consumer.babyY = buyerPub.y
      consumer.babySecret = 'abd'

      const gatewayAddress = await nevermined.services.node.getProviderAddress()
      await nevermined.nfts1155.setApprovalForAll(gatewayAddress, true, publisher)

    })

    it('should create a new agreement (short way)', async () => {
      try {
        await consumer.requestTokens(totalAmount)
      } catch (error) {
        Logger.error(error)
      }
      await token.approve(lockPaymentCondition.getAddress(), totalAmount, consumer)

      agreementId = await dtp.order(ddo.id, BigNumber.from(1), consumer, publisher.getId())

      assert.match(agreementId, /^0x[a-f0-9]{64}$/i)
    })

    it('should fulfill the conditions from publisher side', async () => {
      const result = await dtp.transferForDelegate(ddo.id, agreementId, consumer, BigNumber.from(1), publisher.getId())
      assert.isTrue(result)
    })

    it('buyer should have the key', async () => {
      const key = await dtp.readKey(agreementId, buyerK, providerPub)
      assert.equal(key.toString(), data.toString())
    })

    it('access the asset using key', async () => {
      await nevermined.assets.download(ddo.id, consumer, undefined, 1, 'nft-sales-proof')
    })
  })
})
