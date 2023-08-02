import { Account, AgreementTemplate, DDO } from '@nevermined-io/sdk'
import {
  ServiceType,
  ValidationParams,
  ServiceAgreementTemplate,
  NFT721HolderCondition,
  AgreementInstance,
  InstantiableConfig,
} from '@nevermined-io/sdk'
import { AccessDLEQCondition } from './AccessDLEQCondition'
import { nft721AccessTemplateServiceAgreementTemplateDLEQ } from './NFT721AccessProofTemplate.serviceAgreementTemplate'
import { Dtp } from './Dtp'
import { DLEQTemplate } from './ProofTemplate'
import { ServiceNFTAccessProof } from './Service'

export interface NFT721AccessDLEQTemplateParams {
  holderAddress: string
  consumer: Account
}

export class NFT721AccessDLEQTemplate extends DLEQTemplate<
  NFT721AccessDLEQTemplateParams,
  ServiceNFTAccessProof
> {
  public dtp: Dtp
  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp,
  ): Promise<NFT721AccessDLEQTemplate> {
    const res = await AgreementTemplate.getInstance(
      config,
      'NFT721AccessDLEQTemplate',
      NFT721AccessDLEQTemplate,
      true,
    )
    res.dtp = dtp
    return res
  }

  public service(): ServiceType {
    return 'nft-access'
  }

  public async paramsGen(params: ValidationParams): Promise<NFT721AccessDLEQTemplateParams> {
    const consumer = await this.dtp.consumerAccount(params.buyer, params.consumer_address)
    return this.params(params.consumer_address, consumer)
  }

  public conditions(): [NFT721HolderCondition, AccessDLEQCondition] {
    const { nft721HolderCondition } = this.nevermined.keeper.conditions
    const { accessDLEQCondition } = this.dtp
    return [nft721HolderCondition, accessDLEQCondition]
  }

  public name(): string {
    return 'dataAssetNFT721AccessDLEQServiceAgreement'
  }

  public description(): string {
    return 'Data Asset NFT-721 Access Service Agreement w/ DLEQ proof'
  }

  public params(holderAddress: string, consumer: Account): NFT721AccessDLEQTemplateParams {
    return { holderAddress, consumer }
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: NFT721AccessDLEQTemplateParams,
  ): Promise<AgreementInstance<NFT721AccessDLEQTemplateParams>> {
    const { nft721HolderCondition } = this.nevermined.keeper.conditions
    const { accessDLEQCondition } = this.dtp

    const agreementId = await this.agreementId(agreementIdSeed, creator)
    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters,
    }

    const holderConditionInstance = await nft721HolderCondition.instanceFromDDO(agreementId, ctx)
    const accessConditionInstance = await accessDLEQCondition.instanceFromDDO(agreementId, ctx)

    return {
      instances: [holderConditionInstance, accessConditionInstance],
      list: parameters,
      agreementId,
    }
  }

  public getServiceAgreementTemplate(): ServiceAgreementTemplate {
    return nft721AccessTemplateServiceAgreementTemplateDLEQ()
  }
}
