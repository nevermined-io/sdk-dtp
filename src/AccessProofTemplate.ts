import {
  Account,
  AgreementTemplate,
  DDO,
  MetaData,
  ServiceType,
  ValidationParams,
  AssetPrice,
  LockPaymentCondition,
  EscrowPaymentCondition,
  AgreementInstance,
  InstantiableConfig,
  AccessProofTemplateParams,
} from '@nevermined-io/nevermined-sdk-js'
import { AccessProofCondition } from './AccessProofCondition'
import { accessTemplateServiceAgreementTemplate } from './AccessProofTemplate.serviceAgreementTemplate'
import { Dtp } from './Dtp'
import { ProofTemplate } from './ProofTemplate'
import { ServiceAccessProof } from './Service'


type AccessProofTemplateParamsDtp = Pick<AccessProofTemplateParams, "consumer" | "consumerId">

export class AccessProofTemplate extends ProofTemplate<
  AccessProofTemplateParamsDtp,
  ServiceAccessProof
> {
  public dtp: Dtp

  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp,
  ): Promise<AccessProofTemplate> {
    const res: AccessProofTemplate = await AgreementTemplate.getInstance(
      config,
      'AccessProofTemplate',
      AccessProofTemplate,
      true,
    )
    res.dtp = dtp
    return res
  }

  public async createService(
    publisher: Account,
    metadata: MetaData,
    assetPrice?: AssetPrice,
    erc20TokenAddress?: string,
  ): Promise<ServiceAccessProof> {
    return await super.createService(publisher, metadata, assetPrice, erc20TokenAddress, true)
  }

  public async getServiceAgreementTemplate() {
    return accessTemplateServiceAgreementTemplate
  }

  public name(): string {
    return 'dataAssetAccessProofServiceAgreement'
  }

  public description(): string {
    return 'Data Asset Access Service Agreement w/ proof'
  }

  public service(): ServiceType {
    return 'access'
  }

  public async paramsGen(params: ValidationParams): Promise<AccessProofTemplateParamsDtp> {
    const consumer = await this.dtp.consumerAccount(
      params.buyer,
      params.consumer_address,
      params.babysig,
    )
    return this.params(consumer)
  }

  public params(consumer: Account): AccessProofTemplateParamsDtp {
    return { consumer, consumerId: consumer.getId() }
  }

  public conditions(): [AccessProofCondition, LockPaymentCondition, EscrowPaymentCondition] {
    const { lockPaymentCondition, escrowPaymentCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp
    return [accessProofCondition, lockPaymentCondition, escrowPaymentCondition]
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: AccessProofTemplateParams,
  ): Promise<AgreementInstance<AccessProofTemplateParams>> {
    const { lockPaymentCondition, escrowPaymentCondition } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp

    const agreementId = await this.agreementId(agreementIdSeed, creator)

    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters,
    }

    const lockPaymentConditionInstance = await lockPaymentCondition.instanceFromDDO(
      agreementId,
      ctx,
    )
    const accessConditionInstance = await accessProofCondition.instanceFromDDO(agreementId, ctx)
    const escrowPaymentConditionInstance = await escrowPaymentCondition.instanceFromDDO(
      agreementId,
      ctx,
      accessConditionInstance,
      lockPaymentConditionInstance,
    )

    return {
      instances: [
        accessConditionInstance,
        lockPaymentConditionInstance,
        escrowPaymentConditionInstance,
      ],
      list: parameters,
      agreementId,
    }
  }
}
