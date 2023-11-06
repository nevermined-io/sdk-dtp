import { Account, AgreementTemplate, DDO } from '@nevermined-io/sdk'
import {
  ServiceType,
  ValidationParams,
  ServiceAgreementTemplate,
  NFTHolderCondition,
  AgreementInstance,
  InstantiableConfig,
} from '@nevermined-io/sdk'
import { AccessDLEQCondition } from './AccessDLEQCondition'
import { nftAccessTemplateServiceAgreementTemplateDLEQ } from './NFTAccessProofTemplate.serviceAgreementTemplate'
import { Dtp } from './Dtp'
import { DLEQTemplate } from './ProofTemplate'
import { ServiceNFTAccessProof } from './Service'

export interface NFTAccessDLEQTemplateParams {
  holderAddress: string
  amount: bigint
  consumer: Account
}

export class NFTAccessDLEQTemplate extends DLEQTemplate<
  NFTAccessDLEQTemplateParams,
  ServiceNFTAccessProof
> {
  public dtp: Dtp
  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp,
  ): Promise<NFTAccessDLEQTemplate> {
    const res = await AgreementTemplate.getInstance(
      config,
      'NFTAccessDLEQTemplate',
      NFTAccessDLEQTemplate,
      true,
    )
    res.dtp = dtp
    return res
  }

  public service(): ServiceType {
    return 'nft-access'
  }

  public name(): string {
    return 'dataAssetNFTAccessDLEQServiceAgreement'
  }

  public description(): string {
    return 'Data Asset NFT 1155 Access Service Agreement w/ DLEQ proof'
  }

  public async paramsGen(params: ValidationParams): Promise<NFTAccessDLEQTemplateParams> {
    const consumer = await this.dtp.consumerAccount(params.buyer, params.consumer_address)
    return this.params(consumer, params.consumer_address, params.nft_amount)
  }

  public conditions(): [NFTHolderCondition, AccessDLEQCondition] {
    const { nftHolderCondition } = this.nevermined.keeper.conditions
    const { accessDLEQCondition } = this.dtp
    return [nftHolderCondition, accessDLEQCondition]
  }

  public params(
    consumer: Account,
    holderAddress: string,
    amount: bigint,
  ): NFTAccessDLEQTemplateParams {
    return { holderAddress, amount, consumer }
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: NFTAccessDLEQTemplateParams,
  ): Promise<AgreementInstance<NFTAccessDLEQTemplateParams>> {
    const { nftHolderCondition } = this.nevermined.keeper.conditions
    const { accessDLEQCondition } = this.dtp

    const agreementId = await this.agreementId(agreementIdSeed, creator)

    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters,
    }

    const holderConditionInstance = await nftHolderCondition.instanceFromDDO(agreementId, ctx)
    const accessConditionInstance = await accessDLEQCondition.instanceFromDDO(agreementId, ctx)

    return {
      instances: [holderConditionInstance, accessConditionInstance],
      list: parameters,
      agreementId,
    }
  }

  public getServiceAgreementTemplate(): ServiceAgreementTemplate {
    return nftAccessTemplateServiceAgreementTemplateDLEQ()
  }
}
