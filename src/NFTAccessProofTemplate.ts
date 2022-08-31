import { Account, AgreementTemplate, DDO } from '@nevermined-io/nevermined-sdk-js'
import { ServiceType } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service'
import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/ServiceAgreementTemplate'
import { InstantiableConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import {
  BaseTemplate,
  AgreementInstance
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates'
import { Dtp } from './Dtp'
import { nftAccessTemplateServiceAgreementTemplate } from './NFTAccessProofTemplate.serviceAgreementTemplate'

export interface NFTAccessProofTemplateParams {
  holderAddress: string
  amount: number
  consumer: Account
}

export class NFTAccessProofTemplate extends BaseTemplate<NFTAccessProofTemplateParams> {
  public dtp: Dtp
  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp
  ): Promise<NFTAccessProofTemplate> {
    const res = await AgreementTemplate.getInstance(
      config,
      'NFTAccessProofTemplate',
      NFTAccessProofTemplate,
      true
    )
    res.dtp = dtp
    return res
  }

  public service(): ServiceType {
    return 'nft-access-proof'
  }

  public name(): string {
    return 'dataAssetNFTAccessProofServiceAgreement'
  }

  public description(): string {
    return 'Data Asset NFT 1155 Access Service Agreement w/ proof'
  }

  public params(
    consumer: Account,
    holderAddress: string,
    amount: number
  ): NFTAccessProofTemplateParams {
    return { holderAddress, amount, consumer }
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: NFTAccessProofTemplateParams
  ): Promise<AgreementInstance<NFTAccessProofTemplateParams>> {
    const { nftHolderCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp

    const agreementId = await this.agreementId(agreementIdSeed, creator)
    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters
    }

    const holderConditionInstance = await nftHolderCondition.instanceFromDDO(
      agreementId,
      ctx
    )
    const accessConditionInstance = await accessProofCondition.instanceFromDDO(
      agreementId,
      ctx
    )

    return {
      instances: [holderConditionInstance, accessConditionInstance],
      list: parameters,
      agreementId
    }
  }

  public async getServiceAgreementTemplate(): Promise<ServiceAgreementTemplate> {
    return nftAccessTemplateServiceAgreementTemplate
  }
}
