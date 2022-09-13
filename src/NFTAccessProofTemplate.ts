import { Account, AgreementTemplate, DDO } from '@nevermined-io/nevermined-sdk-js'
import { ServiceType, ValidationParams } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service'
import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/ServiceAgreementTemplate'
import { InstantiableConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import { NFTHolderCondition } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions'
import {
  AgreementInstance
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates'
import BigNumber from '@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber'
import { AccessProofCondition } from './AccessProofCondition'
import { Dtp, ProofTemplate } from './Dtp'
import { nftAccessTemplateServiceAgreementTemplate } from './NFTAccessProofTemplate.serviceAgreementTemplate'

export interface NFTAccessProofTemplateParams {
  holderAddress: string
  amount: BigNumber
  consumer: Account
}

export class NFTAccessProofTemplate extends ProofTemplate<NFTAccessProofTemplateParams> {
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
    return 'nft-access'
  }

  public name(): string {
    return 'dataAssetNFTAccessProofServiceAgreement'
  }

  public description(): string {
    return 'Data Asset NFT 1155 Access Service Agreement w/ proof'
  }

  public async paramsGen(params: ValidationParams): Promise<NFTAccessProofTemplateParams> {
    const consumer = await this.dtp.babyjubPublicAccount('0x'+params.buyer.substring(0,64), '0x'+params.buyer.substring(64,128))
    return this.params(consumer, params.consumer_address, params.nft_amount)
  }

  public conditions(): [AccessProofCondition, NFTHolderCondition] {
    const { nftHolderCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp
    return [
      accessProofCondition,
      nftHolderCondition
    ]
  }

  public params(
    consumer: Account,
    holderAddress: string,
    amount: BigNumber
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
