// Extension of main nevermined object
import { AccessProofConditionExtra } from './AccessProofCondition'
import {
  Account,
  MetaData,
  MetaDataMain,
  Nevermined,
  BaseTemplate,
  Service,
  ValidationParams,
  AssetPrice,
} from '@nevermined-io/sdk'
import { CryptoConfig, decrypt } from './utils'
import { Dtp } from './Dtp'
import { AccessDLEQConditionExtra } from './AccessDLEQCondition'

type AssetData = { url: string; content_type: string }

export const getAssetUrl = async (
  nevermined: Nevermined,
  config: CryptoConfig,
  did: string,
  index: number,
): Promise<AssetData> => {
  // get url for DID
  const asset = await nevermined.assets.resolve(did)
  const service = asset.findServiceByType('metadata')
  const file_attributes = service.attributes.main.files[index]
  const content_type = file_attributes.contentType
  const auth_method = asset.findServiceByType('authorization').service || 'RSAES-OAEP'
  if (auth_method === 'RSAES-OAEP') {
    const filelist = JSON.parse(await decrypt(config, service.attributes.encryptedFiles, 'PSK-RSA'))
    // download url or what?
    const { url } = filelist[index]
    return { url, content_type }
  }
  throw new Error('Bad authentication method')
}

export abstract class ProofTemplate<Params, S extends Service> extends BaseTemplate<Params, S> {
  public dtp: Dtp

  public async createService(
    publisher: Account,
    metadata: MetaData,
    assetPrice?: AssetPrice,
    erc20TokenAddress?: string,
    priced?: boolean,
  ): Promise<S> {
    const service = await super.createService(
      publisher,
      metadata,
      assetPrice,
      erc20TokenAddress,
      priced,
    )
    
    return {
      ...service,
      attributes: {
        ...service.attributes,
        main: {
          ...service.attributes.main,
          _hash: metadata.additionalInformation!.poseidonHash,
          _cipherDLEQ: ((metadata.additionalInformation as any).cipher),
          _secretId: ((metadata.additionalInformation as any).secretId),
          _providerPub: {
            x: metadata.additionalInformation.providerKey.x,
            y: metadata.additionalInformation.providerKey.y,
          },
        },
      },
    } as S
  }

  public async extraGen(params: ValidationParams): Promise<any> {
    const { url } = await getAssetUrl(this.nevermined, this.dtp.cryptoConfig, params.did, 0)
    const data = Buffer.from(url, 'hex')
    const extra: AccessProofConditionExtra = {
      providerK: this.dtp.keytransfer.makeKey(process.env.PROVIDER_BABYJUB_SECRET),
      data,
    }
    return extra
  }

  public isDTP(main: MetaDataMain): boolean {
    return main.files && main.files.some((f) => f.encryption === 'dtp')
  }
}

export abstract class DLEQTemplate<Params, S extends Service> extends BaseTemplate<Params, S> {
  public dtp: Dtp

  public async createService(
    publisher: Account,
    metadata: MetaData,
    assetPrice?: AssetPrice,
    erc20TokenAddress?: string,
    priced?: boolean,
  ): Promise<S> {
    const service = await super.createService(
      publisher,
      metadata,
      assetPrice,
      erc20TokenAddress,
      priced,
    )
    const { secretId, providerKey, cipher } = metadata.additionalInformation as any
    return {
      ...service,
      attributes: {
        ...service.attributes,
        main: {
          ...service.attributes.main,
          _cipherDLEQ: cipher,
          _providerPub: {
            x: providerKey.x,
            y: providerKey.y,
          },
          _secretId: {
            x: secretId.x,
            y: secretId.y,
          },
        },
      },
    } as S
  }

  public async extraGen(params: ValidationParams): Promise<any> {
    const extra: AccessDLEQConditionExtra = {
      providerK: this.dtp.keytransfer.makeKey(process.env.PROVIDER_DLEQ_SECRET),
      agreementId: params.agreement_id
    }
    return extra
  }

  public isDLEQ(main: MetaDataMain): boolean {
    return main.files && main.files.some((f) => f.encryption as any=== 'dleq')
  }
}
