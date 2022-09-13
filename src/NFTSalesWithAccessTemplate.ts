import { Account, AgreementTemplate, DDO } from '@nevermined-io/nevermined-sdk-js'
import { ServiceType, ValidationParams } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service'
import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/ServiceAgreementTemplate'
import { InstantiableConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import {
  BaseTemplate,
  AgreementInstance
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates'
import { Dtp } from './Dtp'
import { nftSalesTemplateServiceAgreementTemplate } from './NFTSalesWithAccessTemplate.serviceAgreementTemplate'
import { LockPaymentCondition, TransferNFTCondition, EscrowPaymentCondition } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions'
import { AccessProofCondition } from './AccessProofCondition'
import BigNumber from '@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber'

export interface NFTSalesWithAccessTemplateParams {
  consumerId: string
  providerId: string
  consumer: Account
  expiration: number
  nftAmount: BigNumber
}

export class NFTSalesWithAccessTemplate extends BaseTemplate<
  NFTSalesWithAccessTemplateParams
> {
  public dtp: Dtp
  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp
  ): Promise<NFTSalesWithAccessTemplate> {
    const res = await AgreementTemplate.getInstance(
      config,
      'NFTSalesWithAccessTemplate',
      NFTSalesWithAccessTemplate,
      true
    )
    res.dtp = dtp
    return res
  }

  public service(): ServiceType {
    return 'nft-sales'
  }

  public name(): string {
    return 'dataAssetNFTSalesProofServiceAgreement'
  }

  public async paramsGen(params: ValidationParams): Promise<NFTSalesWithAccessTemplateParams> {
    const consumer = await this.dtp.babyjubPublicAccount('0x'+params.buyer.substring(0,64), '0x'+params.buyer.substring(64,128))
    return this.params(consumer, params.nft_holder)
  }

  public conditions(): [AccessProofCondition, TransferNFTCondition, LockPaymentCondition, EscrowPaymentCondition] {
    const { transferNftCondition,
      lockPaymentCondition,
      escrowPaymentCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp
    return [
      accessProofCondition,
      transferNftCondition,
      lockPaymentCondition,
      escrowPaymentCondition
    ]
  }

  public params(
    consumer: Account,
    providerId: string,
    nftAmount: BigNumber = BigNumber.from(1),
    expiration: number = 0
  ): NFTSalesWithAccessTemplateParams {
    return { consumer, consumerId: consumer.getId(), expiration, nftAmount, providerId }
  }

  public description(): string {
    return 'Data Asset NFT Transfer Service Agreement w/ proof'
  }

  public lockConditionIndex(): number {
    return 0
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: NFTSalesWithAccessTemplateParams
  ): Promise<AgreementInstance<NFTSalesWithAccessTemplateParams>> {
    const {
      transferNftCondition,
      lockPaymentCondition,
      escrowPaymentCondition
    } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp

    const agreementId = await this.agreementId(agreementIdSeed, creator)
    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters
    }

    const lockPaymentConditionInstance = await lockPaymentCondition.instanceFromDDO(
      agreementId,
      ctx
    )
    const transferConditionInstance = await transferNftCondition.instanceFromDDO(
      agreementId,
      ctx,
      lockPaymentConditionInstance
    )
    const accessConditionInstance = await accessProofCondition.instanceFromDDO(
      agreementId,
      ctx
    )
    const escrowPaymentConditionInstance = await escrowPaymentCondition.instanceFromDDO(
      agreementId,
      ctx,
      transferConditionInstance,
      lockPaymentConditionInstance,
      accessConditionInstance
    )

    return {
      instances: [
        lockPaymentConditionInstance,
        transferConditionInstance,
        escrowPaymentConditionInstance,
        accessConditionInstance
      ],
      list: parameters,
      agreementId
    }
  }

  public async getServiceAgreementTemplate(): Promise<ServiceAgreementTemplate> {
    return nftSalesTemplateServiceAgreementTemplate
  }
}
