// Extension of main nevermined object
import {
  Instantiable,
  InstantiableConfig,
} from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import { AccessProofTemplate } from './AccessProofTemplate'
import { AccessProofCondition } from './AccessProofCondition'
import { Account, ServiceType } from '@nevermined-io/nevermined-sdk-js'
import { makeKeyTransfer, KeyTransfer, Babysig } from './KeyTransfer'
import {
  AssetError,
  NeverminedNodeError,
  KeeperError,
} from '@nevermined-io/nevermined-sdk-js/dist/node/errors'
import { noZeroX } from '@nevermined-io/nevermined-sdk-js/dist/node/utils'
import {
  BabyjubPublicKey,
  MimcCipher,
} from '@nevermined-io/nevermined-sdk-js/dist/node/models/KeyTransfer'
import { TxParameters } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/ContractBase'

import { EventOptions } from '@nevermined-io/nevermined-sdk-js/dist/node/events'
import { NFTAccessProofTemplate } from './NFTAccessProofTemplate'
import { NFT721AccessProofTemplate } from './NFT721AccessProofTemplate'
import { NFT721SalesWithAccessTemplate } from './NFT721SalesWithAccessTemplate'
import { NFTSalesWithAccessTemplate } from './NFTSalesWithAccessTemplate'
import { CryptoConfig } from './utils'
import { AccessProofService, NFTAccessProofService, NFTSalesProofService } from './Service'

export class Dtp extends Instantiable {
  public accessProofCondition: AccessProofCondition
  public accessProofTemplate: AccessProofTemplate
  public nftAccessProofTemplate: NFTAccessProofTemplate
  public nft721AccessProofTemplate: NFT721AccessProofTemplate
  public nftSalesWithAccessTemplate: NFTSalesWithAccessTemplate
  public nft721SalesWithAccessTemplate: NFT721SalesWithAccessTemplate
  public keytransfer: KeyTransfer
  public cryptoConfig: CryptoConfig

  public static async getInstance(
    config: InstantiableConfig,
    cryptoConfig: CryptoConfig,
  ): Promise<Dtp> {
    const dtp = new Dtp()
    dtp.cryptoConfig = cryptoConfig
    dtp.setInstanceConfig(config)
    dtp.accessProofCondition = await AccessProofCondition.getInstance(config)
    dtp.accessProofTemplate = await AccessProofTemplate.getInstanceDtp(config, dtp)
    dtp.nftAccessProofTemplate = await NFTAccessProofTemplate.getInstanceDtp(config, dtp)
    dtp.nftSalesWithAccessTemplate = await NFTSalesWithAccessTemplate.getInstanceDtp(config, dtp)
    dtp.nft721AccessProofTemplate = await NFT721AccessProofTemplate.getInstanceDtp(config, dtp)
    dtp.nft721SalesWithAccessTemplate = await NFT721SalesWithAccessTemplate.getInstanceDtp(
      config,
      dtp,
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.accessProofTemplate.address,
      dtp.accessProofTemplate,
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.nftAccessProofTemplate.address,
      dtp.nftAccessProofTemplate,
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.nftSalesWithAccessTemplate.address,
      dtp.nftSalesWithAccessTemplate,
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.nft721AccessProofTemplate.address,
      dtp.nft721AccessProofTemplate,
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.nft721SalesWithAccessTemplate.address,
      dtp.nft721SalesWithAccessTemplate,
    )
    config.nevermined.keeper.conditionsList.push(dtp.accessProofCondition)
    config.nevermined.keeper.templateList.push(dtp.accessProofTemplate)
    config.nevermined.keeper.templateList.push(dtp.nftAccessProofTemplate)
    config.nevermined.keeper.templateList.push(dtp.nft721AccessProofTemplate)
    config.nevermined.keeper.templateList.push(dtp.nftSalesWithAccessTemplate)
    config.nevermined.keeper.templateList.push(dtp.nft721SalesWithAccessTemplate)

    config.nevermined.assets.servicePlugin['access'] = new AccessProofService(
      config,
      dtp.accessProofTemplate,
    )
    config.nevermined.nfts1155.servicePlugin['nft-access'] = new NFTAccessProofService(
      config,
      dtp.nftAccessProofTemplate,
      dtp.nft721AccessProofTemplate,
    )
    config.nevermined.nfts1155.servicePlugin['nft-sales'] = new NFTSalesProofService(
      config,
      dtp.nftSalesWithAccessTemplate,
      dtp.nft721SalesWithAccessTemplate,
    )
    dtp.keytransfer = await makeKeyTransfer()
    return dtp
  }

  public async signBabyjub(acc: Account, num: bigint) {
    return this.keytransfer.signBabyjub(acc.babySecret, num)
  }

  public async consumeProof(
    agreementId: string,
    did: string,
    consumerAccount: Account,
    service: ServiceType = 'access',
  ): Promise<string | true> {
    const ddo = await this.nevermined.assets.resolve(did)
    const { serviceEndpoint } = ddo.findServiceByType(service)

    if (!serviceEndpoint) {
      throw new AssetError(
        'Consume asset failed, service definition is missing the `serviceEndpoint`.',
      )
    }
    return await this.consumeProofService(
      did,
      agreementId,
      serviceEndpoint,
      consumerAccount,
      service,
    )
  }

  public async consumeProofService(
    did: string,
    agreementId: string,
    serviceEndpoint: string,
    account: Account,
    service: ServiceType,
  ): Promise<string> {
    const { jwt } = this.nevermined.utils
    let accessToken: string
    const cacheKey = jwt.generateCacheKey(account.getId(), agreementId, did)

    if (!jwt.tokenCache.has(cacheKey)) {
      const address = account.getId()
      const grantToken = await jwt.generateToken(account, agreementId, did, '/' + service, {
        babysig: await this.signBabyjub(account, BigInt(address)),
        buyer: account.getPublic(),
      })
      accessToken = await this.nevermined.services.node.fetchToken(grantToken)
      jwt.tokenCache.set(cacheKey, accessToken)
    } else {
      accessToken = this.nevermined.utils.jwt.tokenCache.get(cacheKey)!
    }
    const headers = {
      Authorization: 'Bearer ' + accessToken,
    }

    const consumeUrl = `${serviceEndpoint}/${noZeroX(agreementId)}/0`
    try {
      return await this.nevermined.utils.fetch.downloadUrl(consumeUrl, headers)
    } catch (e) {
      throw new NeverminedNodeError(`Error consuming assets - ${e}`)
    }
  }

  /**
   * Transfer the key to the buyer.
   * @param agreementId - Agreement ID.
   * @param data        - key plain text.
   * @param providerK   - Provider secret key.
   * @param buyerPub - Buyer public key.
   * @param providerPub - Provider public key.
   * @param from        - Account of sender.
   */
  public async transferKey(
    agreementId: string,
    data: Buffer,
    providerK: string,
    buyerPub: BabyjubPublicKey,
    providerPub: BabyjubPublicKey,
    from?: Account,
    params?: TxParameters,
  ) {
    try {
      const keyTransfer = await makeKeyTransfer()
      const cipher = await keyTransfer.encryptKey(data, await keyTransfer.ecdh(providerK, buyerPub))
      const proof = await keyTransfer.prove(buyerPub, providerPub, providerK, data)
      const hash = await keyTransfer.hashKey(data)
      const receipt = await this.accessProofCondition.fulfill(
        agreementId,
        hash,
        buyerPub,
        providerPub,
        cipher,
        proof,
        from,
        params,
      )
      return !!receipt
    } catch (e) {
      throw new KeeperError(e)
    }
  }

  public async babyjubAccount(mnemonic: string): Promise<Account> {
    const keyTransfer = await makeKeyTransfer()
    const account = new Account()
    account.babySecret = mnemonic
    const pub = await keyTransfer.secretToPublic(keyTransfer.makeKey(mnemonic))
    account.babyX = pub.x
    account.babyY = pub.y
    return account
  }

  public async consumerAccount(baby: string, eth: string, babysig: Babysig): Promise<Account> {
    const account = new Account(eth)
    account.babyX = '0x' + baby.substring(0, 64)
    account.babyY = '0x' + baby.substring(64, 128)
    const buyerPub = new BabyjubPublicKey(account.babyX, account.babyY)
    if (babysig && !(await this.keytransfer.verifyBabyjub(buyerPub, BigInt(eth), babysig))) {
      throw new Error(`Bad signature for address ${eth}`)
    }
    return account
  }

  public async babyjubPublicAccount(x: string, y: string): Promise<Account> {
    const account = new Account()
    account.babyX = x
    account.babyY = y
    return account
  }

  /**
   * Read the transferred key from chain.
   * @param agreementId - Agreement ID.
   * @param buyerK      - Buyer secret key.
   * @param providerPub - Provider public key.
   * @param from        - Account of sender.
   */
  public async readKey(agreementId: string, buyerK: string, providerPub: BabyjubPublicKey) {
    // const { accessProofCondition } = this.nevermined.keeper.conditions
    const evOptions: EventOptions = {
      eventName: 'Fulfilled',
      methodName: 'getFulfilleds',
      filterJsonRpc: { _agreementId: agreementId },
      filterSubgraph: { where: { _agreementId: agreementId } },
      result: {
        _agreementId: true,
        _origHash: true,
        _buyer: true,
        _provider: true,
        _cipher: true,
        _proof: true,
        _conditionId: true,
      },
    }
    const ev = await this.accessProofCondition.events.once((events) => events, evOptions)

    if (!ev.length) {
      throw new KeeperError('No events are returned')
    }

    const [cipherL, cipherR] = ev[0].args._cipher

    const keyTransfer = await makeKeyTransfer()
    return keyTransfer.decryptKey(
      new MimcCipher(cipherL, cipherR),
      await keyTransfer.ecdh(buyerK, providerPub),
    )
  }
}
