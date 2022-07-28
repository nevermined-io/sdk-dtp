import { Account, AgreementTemplate, DDO } from "@nevermined-io/nevermined-sdk-js"
import { ServiceType } from "@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service"
import { InstantiableConfig } from "@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract"
import { BaseTemplate, AgreementInstance } from "@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates"
import { accessTemplateServiceAgreementTemplate } from "./AccessProofTemplate.serviceAgreementTemplate"
import { Dtp } from "./Dtp"

export interface AccessProofTemplateParams {
    consumer: Account
    consumerId: string
}

export class AccessProofTemplate extends BaseTemplate<AccessProofTemplateParams> {
    public dtp: Dtp
    public static async getInstanceDtp(
        config: InstantiableConfig,
        dtp: Dtp
    ): Promise<AccessProofTemplate> {
        const res: AccessProofTemplate = await AgreementTemplate.getInstance(
            config,
            'AccessProofTemplate',
            AccessProofTemplate,
            true
        )
        res.dtp = dtp
        return res
    }

    public async getServiceAgreementTemplate() {
        return accessTemplateServiceAgreementTemplate
    }

    public service(): ServiceType {
        return 'access-proof'
    }

    public params(consumer: Account): AccessProofTemplateParams {
        return { consumer, consumerId: consumer.getId() }
    }

    public async instanceFromDDO(
        agreementIdSeed: string,
        ddo: DDO,
        creator: string,
        parameters: AccessProofTemplateParams
    ): Promise<AgreementInstance<AccessProofTemplateParams>> {
        const {
            lockPaymentCondition,
            escrowPaymentCondition
        } = this.nevermined.keeper.conditions
        const accessProofCondition = this.dtp.accessProofCondition

        const agreementId = await this.agreementId(agreementIdSeed, creator)

        const ctx = {
            ...this.standardContext(ddo, creator),
            ...parameters
        }

        const lockPaymentConditionInstance = await lockPaymentCondition.instanceFromDDO(
            agreementId,
            ctx
        )
        const accessConditionInstance = await accessProofCondition.instanceFromDDO(
            agreementId,
            ctx
        )
        const escrowPaymentConditionInstance = await escrowPaymentCondition.instanceFromDDO(
            agreementId,
            ctx,
            accessConditionInstance,
            lockPaymentConditionInstance
        )

        return {
            instances: [
                accessConditionInstance,
                lockPaymentConditionInstance,
                escrowPaymentConditionInstance
            ],
            list: parameters,
            agreementId
        }
    }
}
