// Extension of main nevermined object
import {
  Instantiable,
  InstantiableConfig
} from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import { AccessProofTemplate } from './AccessProofTemplate'
import { AccessProofCondition, AccessProofConditionExtra } from './AccessProofCondition'
import { Account, MetaData, Nevermined } from '@nevermined-io/nevermined-sdk-js'
import {
  ServiceAccessProof,
  ServiceCommon,
  ServicePlugin,
  ServiceType,
  ValidationParams
} from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service'
import { makeKeyTransfer, KeyTransfer } from './KeyTransfer'
import {
  AssetError,
  GatewayError,
  KeeperError
} from '@nevermined-io/nevermined-sdk-js/dist/node/errors'
import { noZeroX } from '@nevermined-io/nevermined-sdk-js/dist/node/utils'
import {
  BabyjubPublicKey,
  MimcCipher
} from '@nevermined-io/nevermined-sdk-js/dist/node/models/KeyTransfer'
import { TxParameters } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/ContractBase'
import { AccessService, NFTAccessService } from '@nevermined-io/nevermined-sdk-js/dist/node/nevermined/AccessService'
import { EventOptions } from '@nevermined-io/nevermined-sdk-js/dist/node/events'
import { NFTAccessProofTemplate } from './NFTAccessProofTemplate'
import { NFT721AccessProofTemplate } from './NFT721AccessProofTemplate'
import { NFT721SalesWithAccessTemplate } from './NFT721SalesWithAccessTemplate'
import { NFTSalesWithAccessTemplate } from './NFTSalesWithAccessTemplate'
import { BaseTemplate } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates'
import { decrypt } from './utils'

export async function getAssetUrl(nevermined: Nevermined, did: string, index: number): Promise<{url: string, content_type: string}> {
  // get url for DID
  const asset = await nevermined.assets.resolve(did)
  const service = asset.findServiceByType('metadata')
  const file_attributes = service.attributes.main.files[index]
  const content_type = file_attributes.contentType
  const auth_method = asset.findServiceByType('authorization').service || 'RSAES-OAEP'
  if (auth_method === 'RSAES-OAEP') {
    const filelist = JSON.parse(await decrypt(service.attributes.encryptedFiles, 'PSK-RSA'))
    // download url or what?
    const url: string = filelist[index].url
    return { url, content_type }
  }
  throw new Error('Bad authentication method')
}

export abstract class ProofTemplate<Params> extends BaseTemplate<Params> {
  public dtp: Dtp
  public async createService(
    publisher: Account,
    metadata: MetaData
  ): Promise<ServiceCommon> {
    const serviceAgreementTemplate = await this.getServiceAgreementTemplate()
    return {
      type: this.service(),
      index: 10,
      isDTP: true,
      serviceEndpoint: this.nevermined.gateway.getServiceEndpoint(
        this.service()
      ),
      templateId: this.getAddress(),
      attributes: {
        main: {
          creator: publisher.getId(),
          datePublished: metadata.main.datePublished,
          name: this.name(),
          timeout: 0,
          _hash: metadata.additionalInformation!.poseidonHash,
          _providerPub: [
            metadata.additionalInformation!.providerKey!.x,
            metadata.additionalInformation!.providerKey!.y
          ]
        },
        serviceAgreementTemplate
      }
    } as ServiceCommon
  }
  public async extraGen(params: ValidationParams): Promise<any> {
    const { url } = await getAssetUrl(this.nevermined, params.did, 0);
    const data = Buffer.from(url, 'hex');
    const extra : AccessProofConditionExtra = {
      providerK: this.dtp.keytransfer.makeKey(process.env.PROVIDER_BABYJUB_SECRET),
      data
    };
    return extra
}
}


export class Dtp extends Instantiable {
  public accessProofCondition: AccessProofCondition
  public accessProofTemplate: AccessProofTemplate
  public nftAccessProofTemplate: NFTAccessProofTemplate
  public nft721AccessProofTemplate: NFT721AccessProofTemplate
  public nftSalesWithAccessTemplate: NFTSalesWithAccessTemplate
  public nft721SalesWithAccessTemplate: NFT721SalesWithAccessTemplate
  public keytransfer: KeyTransfer

  public static async getInstance(config: InstantiableConfig): Promise<Dtp> {
    const dtp = new Dtp()
    dtp.setInstanceConfig(config)
    dtp.accessProofCondition = await AccessProofCondition.getInstance(config)
    dtp.accessProofTemplate = await AccessProofTemplate.getInstanceDtp(config, dtp)
    dtp.nftAccessProofTemplate = await NFTAccessProofTemplate.getInstanceDtp(config, dtp)
    dtp.nftSalesWithAccessTemplate = await NFTSalesWithAccessTemplate.getInstanceDtp(
      config,
      dtp
    )
    dtp.nft721AccessProofTemplate = await NFT721AccessProofTemplate.getInstanceDtp(
      config,
      dtp
    )
    dtp.nft721SalesWithAccessTemplate = await NFT721SalesWithAccessTemplate.getInstanceDtp(
      config,
      dtp
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.accessProofTemplate.address,
      dtp.accessProofTemplate
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.nftAccessProofTemplate.address,
      dtp.nftAccessProofTemplate
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.nftSalesWithAccessTemplate.address,
      dtp.nftSalesWithAccessTemplate
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.nft721AccessProofTemplate.address,
      dtp.nft721AccessProofTemplate
    )
    config.nevermined.keeper.agreementStoreManager.addTemplate(
      dtp.nft721SalesWithAccessTemplate.address,
      dtp.nft721SalesWithAccessTemplate
    )
    config.nevermined.keeper.conditionsList.push(dtp.accessProofCondition)
    config.nevermined.keeper.templateList.push(dtp.accessProofTemplate)
    config.nevermined.keeper.templateList.push(dtp.nftAccessProofTemplate)
    config.nevermined.keeper.templateList.push(dtp.nft721AccessProofTemplate)
    config.nevermined.keeper.templateList.push(dtp.nftSalesWithAccessTemplate)
    config.nevermined.keeper.templateList.push(dtp.nft721SalesWithAccessTemplate);
    (config.nevermined.assets.servicePlugin['access'] as AccessService).proof = dtp.accessProofTemplate;
    (config.nevermined.assets.servicePlugin['nft-access'] as NFTAccessService).proof = dtp.nftAccessProofTemplate;
    (config.nevermined.assets.servicePlugin['nft-access'] as NFTAccessService).proof721 = dtp.nft721AccessProofTemplate;
    (config.nevermined.assets.servicePlugin['nft-sales'] as NFTAccessService).proof = dtp.nftSalesWithAccessTemplate;
    (config.nevermined.assets.servicePlugin['nft-sales'] as NFTAccessService).proof721 = dtp.nft721SalesWithAccessTemplate;
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
    service: ServiceType = 'access'
  ): Promise<string | true> {
    const ddo = await this.nevermined.assets.resolve(did)
    const { serviceEndpoint } = ddo.findServiceByType(service)

    if (!serviceEndpoint) {
      throw new AssetError(
        'Consume asset failed, service definition is missing the `serviceEndpoint`.'
      )
    }

    return await this.consumeProofService(
      did,
      agreementId,
      serviceEndpoint,
      consumerAccount,
      service
    )
  }

  public async consumeProofService(
    did: string,
    agreementId: string,
    serviceEndpoint: string,
    account: Account,
    service: ServiceType
  ): Promise<string> {
    const { jwt } = this.nevermined.utils
    let accessToken: string
    const cacheKey = jwt.generateCacheKey(account.getId(), agreementId, did)

    if (!jwt.tokenCache.has(cacheKey)) {
      const address = account.getId()
      const grantToken = await jwt.generateToken(
        account,
        agreementId,
        did,
        '/' + service,
        {
          babysig: await this.signBabyjub(account, BigInt(address)),
          buyer: account.getPublic()
        }
      )
      accessToken = await this.nevermined.gateway.fetchToken(grantToken)
      jwt.tokenCache.set(cacheKey, accessToken)
    } else {
      accessToken = this.nevermined.utils.jwt.tokenCache.get(cacheKey)!
    }
    const headers = {
      Authorization: 'Bearer ' + accessToken
    }

    const consumeUrl = `${serviceEndpoint}/${noZeroX(agreementId)}/0`
    try {
      return await this.nevermined.utils.fetch.downloadUrl(consumeUrl, headers)
    } catch (e) {
      throw new GatewayError(`Error consuming assets - ${e}`)
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
    params?: TxParameters
  ) {
    try {
      const keyTransfer = await makeKeyTransfer()
      const cipher = await keyTransfer.encryptKey(
        data,
        await keyTransfer.ecdh(providerK, buyerPub)
      )
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
        params
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
  public async readKey(
    agreementId: string,
    buyerK: string,
    providerPub: BabyjubPublicKey
  ) {
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
        _conditionId: true
      }
    }
    const ev = await this.accessProofCondition.events.once(events => events, evOptions)

    if (!ev.length) {
      throw new KeeperError('No events are returned')
    }

    const [cipherL, cipherR] = ev[0].args._cipher

    const keyTransfer = await makeKeyTransfer()
    return keyTransfer.decryptKey(
      new MimcCipher(cipherL, cipherR),
      await keyTransfer.ecdh(buyerK, providerPub)
    )
  }
}
