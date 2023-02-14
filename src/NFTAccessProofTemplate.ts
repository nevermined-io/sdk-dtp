import { Account, AgreementTemplate, DDO } from '@nevermined-io/sdk'
import {
  ServiceType,
  ValidationParams,
  ServiceAgreementTemplate,
  NFTHolderCondition,
  AgreementInstance,
  BigNumber,
  InstantiableConfig,
} from '@nevermined-io/sdk'
import { AccessProofCondition } from './AccessProofCondition'
import { nftAccessTemplateServiceAgreementTemplate } from './NFTAccessProofTemplate.serviceAgreementTemplate'
import { Dtp } from './Dtp'
import { ProofTemplate } from './ProofTemplate'
import { ServiceNFTAccessProof } from './Service'

export interface NFTAccessProofTemplateParams {
  holderAddress: string
  amount: BigNumber
  consumer: Account
}

export class NFTAccessProofTemplate extends ProofTemplate<
  NFTAccessProofTemplateParams,
  ServiceNFTAccessProof
> {
  public dtp: Dtp
  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp,
  ): Promise<NFTAccessProofTemplate> {
    const res = await AgreementTemplate.getInstance(
      config,
      'NFTAccessProofTemplate',
      NFTAccessProofTemplate,
      true,
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
    const consumer = await this.dtp.consumerAccount(
      params.buyer,
      params.consumer_address,
      params.babysig,
    )
    return this.params(consumer, params.consumer_address, params.nft_amount)
  }

  public conditions(): [NFTHolderCondition, AccessProofCondition] {
    const { nftHolderCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp
    return [nftHolderCondition, accessProofCondition]
  }

  public params(
    consumer: Account,
    holderAddress: string,
    amount: BigNumber,
  ): NFTAccessProofTemplateParams {
    return { holderAddress, amount, consumer }
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: NFTAccessProofTemplateParams,
  ): Promise<AgreementInstance<NFTAccessProofTemplateParams>> {
    const { nftHolderCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp

    const agreementId = await this.agreementId(agreementIdSeed, creator)

    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters,
    }

    const holderConditionInstance = await nftHolderCondition.instanceFromDDO(agreementId, ctx)
    const accessConditionInstance = await accessProofCondition.instanceFromDDO(agreementId, ctx)

    return {
      instances: [holderConditionInstance, accessConditionInstance],
      list: parameters,
      agreementId,
    }
  }

  public async getServiceAgreementTemplate(): Promise<ServiceAgreementTemplate> {
    return nftAccessTemplateServiceAgreementTemplate
  }
}
