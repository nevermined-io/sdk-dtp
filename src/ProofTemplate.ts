
// Extension of main nevermined object
import { AccessProofConditionExtra } from './AccessProofCondition'
import { Account, MetaData, Nevermined } from '@nevermined-io/nevermined-sdk-js'
import {
    ServiceCommon,
    ValidationParams
} from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service'
import { BaseTemplate } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates'
import { decrypt } from './utils'
import { Dtp } from './Dtp'

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
