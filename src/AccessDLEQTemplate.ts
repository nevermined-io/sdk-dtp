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
} from '@nevermined-io/sdk'
import { AccessDLEQCondition } from './AccessDLEQCondition'
import { accessDLEQTemplateServiceAgreementTemplate } from './AccessProofTemplate.serviceAgreementTemplate'
import { Dtp } from './Dtp'
import { DLEQTemplate } from './ProofTemplate'
import { ServiceAccessProof } from './Service'

export interface AccessDLEQTemplateParams {
  consumer: Account
  consumerId: string
}

export class AccessDLEQTemplate extends DLEQTemplate<AccessDLEQTemplateParams, ServiceAccessProof> {
  public dtp: Dtp

  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp,
  ): Promise<AccessDLEQTemplate> {
    const res: AccessDLEQTemplate = await AgreementTemplate.getInstance(
      config,
      'AccessDLEQTemplate',
      AccessDLEQTemplate,
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
    return accessDLEQTemplateServiceAgreementTemplate
  }

  public name(): string {
    return 'dataAssetAccessDLEQServiceAgreement'
  }

  public description(): string {
    return 'Data Asset Access Service Agreement w/ DLEQ proof'
  }

  public service(): ServiceType {
    return 'access'
  }

  public async paramsGen(params: ValidationParams): Promise<AccessDLEQTemplateParams> {
    const consumer = await this.dtp.consumerAccount(params.buyer, params.consumer_address)
    return this.params(consumer)
  }

  public params(consumer: Account): AccessDLEQTemplateParams {
    return { consumer, consumerId: consumer.getId() }
  }

  public conditions(): [AccessDLEQCondition, LockPaymentCondition, EscrowPaymentCondition] {
    const { lockPaymentCondition, escrowPaymentCondition } = this.nevermined.keeper.conditions
    const { accessDLEQCondition } = this.dtp
    return [accessDLEQCondition, lockPaymentCondition, escrowPaymentCondition]
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: AccessDLEQTemplateParams,
  ): Promise<AgreementInstance<AccessDLEQTemplateParams>> {
    const { lockPaymentCondition, escrowPaymentCondition } = this.nevermined.keeper.conditions
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
    const accessConditionInstance = await accessDLEQCondition.instanceFromDDO(agreementId, ctx)
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
