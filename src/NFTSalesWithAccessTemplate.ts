import { Account, AgreementTemplate, DDO } from '@nevermined-io/nevermined-sdk-js'
import {
  ServiceType,
  ValidationParams,
  ServiceAgreementTemplate,
  AgreementInstance,
  InstantiableConfig,
} from '@nevermined-io/nevermined-sdk-js'
import { nftSalesTemplateServiceAgreementTemplate } from './NFTSalesWithAccessTemplate.serviceAgreementTemplate'
import {
  LockPaymentCondition,
  TransferNFTCondition,
  EscrowPaymentCondition,
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions'
import { AccessProofCondition } from './AccessProofCondition'
import BigNumber from '@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber'
import { Dtp } from './Dtp'
import { ProofTemplate } from './ProofTemplate'
import { ServiceNFTSalesProof } from './Service'

export interface NFTSalesWithAccessTemplateParams {
  consumerId: string
  providerId: string
  consumer: Account
  expiration: number
  nftAmount: BigNumber
}

export class NFTSalesWithAccessTemplate extends ProofTemplate<
  NFTSalesWithAccessTemplateParams,
  ServiceNFTSalesProof
> {
  public dtp: Dtp
  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp,
  ): Promise<NFTSalesWithAccessTemplate> {
    const res = await AgreementTemplate.getInstance(
      config,
      'NFTSalesWithAccessTemplate',
      NFTSalesWithAccessTemplate,
      true,
    )
    res.dtp = dtp
    return res
  }

  public service(): ServiceType {
    return 'nft-sales-proof';
  }

  public name(): string {
    return 'dataAssetNFTSalesProofServiceAgreement'
  }

  public async paramsGen(params: ValidationParams): Promise<NFTSalesWithAccessTemplateParams> {
    const consumer = await this.dtp.consumerAccount(
      params.buyer,
      params.consumer_address,
      params.babysig,
    );
    return this.params(consumer, params.nft_holder, params.nft_amount);
  }

  public conditions(): [
    TransferNFTCondition,
    LockPaymentCondition,
    EscrowPaymentCondition,
    AccessProofCondition,
  ] {
    const {
      transferNftCondition,
      lockPaymentCondition,
      escrowPaymentCondition,
    } = this.nevermined.keeper.conditions
    const { accessProofCondition } = this.dtp
    return [
      transferNftCondition,
      lockPaymentCondition,
      escrowPaymentCondition,
      accessProofCondition,
    ]
  }

  public params(
    consumer: Account,
    providerId: string,
    nftAmount: BigNumber = BigNumber.from(1),
    expiration = 0,
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
    parameters: NFTSalesWithAccessTemplateParams,
  ): Promise<AgreementInstance<NFTSalesWithAccessTemplateParams>> {
    const {
      transferNftCondition,
      lockPaymentCondition,
      escrowPaymentCondition,
    } = this.nevermined.keeper.conditions
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
    const transferConditionInstance = await transferNftCondition.instanceFromDDO(
      agreementId,
      ctx,
      lockPaymentConditionInstance,
    )
    const accessConditionInstance = await accessProofCondition.instanceFromDDO(agreementId, ctx)
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
    return nftSalesTemplateServiceAgreementTemplate
  }
}
