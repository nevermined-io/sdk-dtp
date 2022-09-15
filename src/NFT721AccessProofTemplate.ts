import { Account, AgreementTemplate, DDO } from '@nevermined-io/nevermined-sdk-js'
import { ServiceType, ValidationParams } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service'
import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/ServiceAgreementTemplate'
import { InstantiableConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import { NFT721HolderCondition } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions'
import {
  AgreementInstance
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates'
import { AccessProofCondition } from './AccessProofCondition'
import { nft721AccessTemplateServiceAgreementTemplate } from './NFT721AccessProofTemplate.serviceAgreementTemplate'
import { Dtp } from './Dtp'
import { ProofTemplate } from './ProofTemplate'

export interface NFT721AccessProofTemplateParams {
  holderAddress: string
  consumer: Account
}

export class NFT721AccessProofTemplate extends ProofTemplate<
  NFT721AccessProofTemplateParams
> {
  public dtp: Dtp
  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp
  ): Promise<NFT721AccessProofTemplate> {
    const res = await AgreementTemplate.getInstance(
      config,
      'NFT721AccessProofTemplate',
      NFT721AccessProofTemplate,
      true
    )
    res.dtp = dtp
    return res
  }

  public service(): ServiceType {
    return 'nft-access'
  }

  public async paramsGen(params: ValidationParams): Promise<NFT721AccessProofTemplateParams> {
    const consumer = await this.dtp.consumerAccount(params.buyer, params.consumer_address)
    return this.params(params.consumer_address, consumer)
  }

  public conditions(): [AccessProofCondition, NFT721HolderCondition] {
    const { nft721HolderCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp
    return [
      accessProofCondition,
      nft721HolderCondition
    ]
  }

  public name(): string {
    return 'dataAssetNFT721AccessProofServiceAgreement'
  }

  public description(): string {
    return 'Data Asset NFT-721 Access Service Agreement w/ proof'
  }

  public params(
    holderAddress: string,
    consumer: Account
  ): NFT721AccessProofTemplateParams {
    return { holderAddress, consumer }
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: NFT721AccessProofTemplateParams
  ): Promise<AgreementInstance<NFT721AccessProofTemplateParams>> {
    const { nft721HolderCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp

    const agreementId = await this.agreementId(agreementIdSeed, creator)
    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters
    }

    const holderConditionInstance = await nft721HolderCondition.instanceFromDDO(
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
    return nft721AccessTemplateServiceAgreementTemplate
  }
}
