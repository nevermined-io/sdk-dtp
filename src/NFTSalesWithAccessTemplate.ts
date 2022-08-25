import { Account, AgreementTemplate, DDO } from '@nevermined-io/nevermined-sdk-js'
import { ServiceType } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service'
import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/ServiceAgreementTemplate'
import { InstantiableConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import {
  BaseTemplate,
  AgreementInstance
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates'
import { Dtp } from './Dtp'
import { nftSalesTemplateServiceAgreementTemplate } from './NFTSalesWithAccessTemplate.serviceAgreementTemplate'

export interface NFTSalesWithAccessTemplateParams {
    consumerId: string
    providerId: string
    consumer: Account
    expiration: number
    nftAmount: number
}

export class NFTSalesWithAccessTemplate extends BaseTemplate<NFTSalesWithAccessTemplateParams> {
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
        return 'nft-sales-proof'
    }

    public params(consumer: Account, providerId: string, nftAmount: number = 1, expiration: number = 0): NFTSalesWithAccessTemplateParams {
        return { consumer, consumerId: consumer.getId(), expiration, nftAmount, providerId }
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
        const { transferNftCondition, lockPaymentCondition, escrowPaymentCondition } =
            this.nevermined.keeper.conditions
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
        const escrowPaymentConditionInstance =
            await escrowPaymentCondition.instanceFromDDO(
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
