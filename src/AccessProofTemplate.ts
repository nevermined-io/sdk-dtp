import {
  Account,
  AgreementTemplate,
  DDO,
  MetaData,
  MetaDataMain,
} from '@nevermined-io/nevermined-sdk-js';
import {
  ServicePlugin,
  ServiceType,
  ValidationParams,
} from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service';
import { InstantiableConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import {
  LockPaymentCondition,
  EscrowPaymentCondition,
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions';
import { TxParameters } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/ContractBase';
import {
  AccessTemplate,
  AgreementInstance,
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates';
import AssetRewards from '@nevermined-io/nevermined-sdk-js/dist/node/models/AssetRewards';
import { AccessProofCondition } from './AccessProofCondition';
import { accessTemplateServiceAgreementTemplate } from './AccessProofTemplate.serviceAgreementTemplate';
import { Dtp } from './Dtp';
import { ProofTemplate } from './ProofTemplate';
import { ServiceAccessProof } from './Service';

export interface AccessProofTemplateParams {
  consumer: Account;
  consumerId: string;
}

export class AccessProofTemplate
  extends ProofTemplate<AccessProofTemplateParams, ServiceAccessProof>
  implements ServicePlugin<ServiceAccessProof> {
  public dtp: Dtp;
  private normal: AccessTemplate;

  public static async getInstanceDtp(
    config: InstantiableConfig,
    dtp: Dtp,
  ): Promise<AccessProofTemplate> {
    const res: AccessProofTemplate = await AgreementTemplate.getInstance(
      config,
      'AccessProofTemplate',
      AccessProofTemplate,
      true,
    );
    res.dtp = dtp;
    res.normal = config.nevermined.keeper.templates.accessTemplate;
    return res;
  }

  public async createService(
    publisher: Account,
    metadata: MetaData,
    assetRewards?: AssetRewards,
    erc20TokenAddress?: string,
  ): Promise<ServiceAccessProof> {
    return await super.createService(publisher, metadata, assetRewards, erc20TokenAddress, true);
  }

  // essential method is to select between two services
  public select(main: MetaDataMain): AccessTemplate | AccessProofTemplate {
    return this.isDTP(main) ? this : this.normal;
  }

  public async process(
    params: ValidationParams,
    from: Account,
    txparams?: TxParameters,
  ): Promise<void> {
    const ddo = await this.nevermined.assets.resolve(params.did);
    const metadata = ddo.findServiceByType('metadata').attributes.main;
    return this.select(metadata).process(params, from, txparams);
  }
  public async accept(params: ValidationParams): Promise<boolean> {
    const ddo = await this.nevermined.assets.resolve(params.did);
    const metadata = ddo.findServiceByType('metadata').attributes.main;
    return this.select(metadata).accept(params);
  }

  public async getServiceAgreementTemplate() {
    return accessTemplateServiceAgreementTemplate;
  }

  public name(): string {
    return 'dataAssetAccessProofServiceAgreement';
  }

  public description(): string {
    return 'Data Asset Access Service Agreement w/ proof';
  }

  public service(): ServiceType {
    return 'access';
  }

  public async paramsGen(params: ValidationParams): Promise<AccessProofTemplateParams> {
    const consumer = await this.dtp.consumerAccount(
      params.buyer,
      params.consumer_address,
      params.babysig,
    );
    return this.params(consumer);
  }

  public params(consumer: Account): AccessProofTemplateParams {
    return { consumer, consumerId: consumer.getId() };
  }

  public conditions(): [AccessProofCondition, LockPaymentCondition, EscrowPaymentCondition] {
    const { lockPaymentCondition, escrowPaymentCondition } = this.nevermined.keeper.conditions;
    const { accessProofCondition } = this.dtp;
    return [accessProofCondition, lockPaymentCondition, escrowPaymentCondition];
  }

  public async instanceFromDDO(
    agreementIdSeed: string,
    ddo: DDO,
    creator: string,
    parameters: AccessProofTemplateParams,
  ): Promise<AgreementInstance<AccessProofTemplateParams>> {
    const { lockPaymentCondition, escrowPaymentCondition } = this.nevermined.keeper.conditions;
    const { accessProofCondition } = this.dtp;

    const agreementId = await this.agreementId(agreementIdSeed, creator);

    const ctx = {
      ...this.standardContext(ddo, creator),
      ...parameters,
    };

    const lockPaymentConditionInstance = await lockPaymentCondition.instanceFromDDO(
      agreementId,
      ctx,
    );
    const accessConditionInstance = await accessProofCondition.instanceFromDDO(agreementId, ctx);
    const escrowPaymentConditionInstance = await escrowPaymentCondition.instanceFromDDO(
      agreementId,
      ctx,
      accessConditionInstance,
      lockPaymentConditionInstance,
    );

    return {
      instances: [
        accessConditionInstance,
        lockPaymentConditionInstance,
        escrowPaymentConditionInstance,
      ],
      list: parameters,
      agreementId,
    };
  }
}
