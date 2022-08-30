import { Account, AgreementTemplate, DDO } from '@nevermined-io/nevermined-sdk-js'
import { ServiceType } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service'
import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/ServiceAgreementTemplate'
import { InstantiableConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import {
  BaseTemplate,
  AgreementInstance
} from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates'
import { Dtp } from './Dtp'
import { nft721SalesTemplateServiceAgreementTemplate } from './NFT721SalesWithAccessTemplate.serviceAgreementTemplate'

export interface NFT721SalesWithAccessTemplateParams {
    consumerId: string
    consumer: Account
    expiration: number
}

export class NFT721SalesWithAccessTemplate extends BaseTemplate<NFT721SalesWithAccessTemplateParams> {
    public dtp: Dtp
    public static async getInstanceDtp(
        config: InstantiableConfig,
        dtp: Dtp
    ): Promise<NFT721SalesWithAccessTemplate> {
        const res = await AgreementTemplate.getInstance(
            config,
            'NFT721SalesWithAccessTemplate',
            NFT721SalesWithAccessTemplate,
            true
        )
        res.dtp = dtp
        return res
    }

    public service(): ServiceType {
        return 'nft721-sales-proof'
    }

    public description(): string {
        return 'Data Asset NFT Transfer Service Agreement w/ proof'
    }
    
    public name(): string {
        return 'dataAssetNFT721SalesProofServiceAgreement'
    }

    public params(consumer: Account, expiration: number = 0): NFT721SalesWithAccessTemplateParams {
        return { consumer, consumerId: consumer.getId(), expiration }
    }

    public lockConditionIndex(): number {
        return 0
    }

    public async instanceFromDDO(
        agreementIdSeed: string,
        ddo: DDO,
        creator: string,
        parameters: NFT721SalesWithAccessTemplateParams
    ): Promise<AgreementInstance<NFT721SalesWithAccessTemplateParams>> {
        const { transferNft721Condition, lockPaymentCondition, escrowPaymentCondition } =
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
        const transferConditionInstance = await transferNft721Condition.instanceFromDDO(
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
        return nft721SalesTemplateServiceAgreementTemplate
    }
}
