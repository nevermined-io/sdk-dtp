import { Account, AgreementTemplate, DDO } from '@nevermined-io/sdk'
import {
  ServiceType,
  ValidationParams,
  ServiceAgreementTemplate,
  LockPaymentCondition,
  TransferNFT721Condition,
  EscrowPaymentCondition,
  AgreementInstance,
  InstantiableConfig,
} from '@nevermined-io/sdk'
import { AccessDLEQCondition } from './AccessDLEQCondition'
import { Dtp } from './Dtp'
import { DLEQTemplate } from './ProofTemplate'
import { nft721SalesTemplateServiceAgreementTemplateDLEQ } from './NFT721SalesWithAccessTemplate.serviceAgreementTemplate'
import { ServiceNFTSalesProof } from './Service'

export interface NFT721SalesWithDLEQTemplateParams {
  consumerId: string
  consumer: Account
  expiration: number
}

export class NFT721SalesWithDLEQTemplate extends DLEQTemplate<
  NFT721SalesWithDLEQTemplateParams,
  ServiceNFTSalesProof
> {
  public dtp: Dtp
  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp,
  ): Promise<NFT721SalesWithDLEQTemplate> {
    const res = await AgreementTemplate.getInstance(
      config,
      'NFT721SalesWithDLEQTemplate',
      NFT721SalesWithDLEQTemplate,
      true,
    )
    res.dtp = dtp
    return res
  }

  public service(): ServiceType {
    return 'nft-sales'
  }

  public async paramsGen(params: ValidationParams): Promise<NFT721SalesWithDLEQTemplateParams> {
    const consumer = await this.dtp.consumerAccount(params.buyer, params.consumer_address)
    return this.params(consumer)
  }

  public conditions(): [
    TransferNFT721Condition,
    LockPaymentCondition,
    EscrowPaymentCondition,
    AccessDLEQCondition,
  ] {
    const {
      transferNft721Condition,
      lockPaymentCondition,
      escrowPaymentCondition,
    } = this.nevermined.keeper.conditions
    const { accessDLEQCondition } = this.dtp
    return [
      transferNft721Condition,
      lockPaymentCondition,
      escrowPaymentCondition,
      accessDLEQCondition,
    ]
  }

  public description(): string {
    return 'Data Asset NFT Transfer Service Agreement w/ proof'
  }

  public name(): string {
    return 'dataAssetNFT721SalesProofServiceAgreement'
  }

  public params(consumer: Account, expiration = 0): NFT721SalesWithDLEQTemplateParams {
    return { consumer, consumerId: consumer.getId(), expiration }
  }

  public lockConditionIndex(): number {
    return 0
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: NFT721SalesWithDLEQTemplateParams,
  ): Promise<AgreementInstance<NFT721SalesWithDLEQTemplateParams>> {
    const {
      transferNft721Condition,
      lockPaymentCondition,
      escrowPaymentCondition,
    } = this.nevermined.keeper.conditions
    const { accessDLEQCondition } = this.dtp

    const agreementId = await this.agreementId(agreementIdSeed, creator)
    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters,
    }

    const lockPaymentConditionInstance = await lockPaymentCondition.instanceFromDDO(
      agreementId,
      ctx,
    )
    const transferConditionInstance = await transferNft721Condition.instanceFromDDO(
      agreementId,
      ctx,
      lockPaymentConditionInstance,
    )
    const accessConditionInstance = await accessDLEQCondition.instanceFromDDO(agreementId, ctx)
    const escrowPaymentConditionInstance = await escrowPaymentCondition.instanceFromDDO(
      agreementId,
      ctx,
      transferConditionInstance,
      lockPaymentConditionInstance,
      accessConditionInstance,
    )

    return {
      instances: [
        lockPaymentConditionInstance,
        transferConditionInstance,
        escrowPaymentConditionInstance,
        accessConditionInstance,
      ],
      list: parameters,
      agreementId,
    }
  }

  public async getServiceAgreementTemplate(): Promise<ServiceAgreementTemplate> {
    return nft721SalesTemplateServiceAgreementTemplateDLEQ
  }
}
