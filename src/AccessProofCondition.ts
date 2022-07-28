import { Account, Condition } from '@nevermined-io/nevermined-sdk-js'
import { InstantiableConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract'
import { ConditionContext } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions'
import { TxParameters } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/ContractBase'
import { BabyjubPublicKey, MimcCipher } from '@nevermined-io/nevermined-sdk-js/dist/node/models/KeyTransfer'
import { zeroX } from '@nevermined-io/nevermined-sdk-js/dist/node/utils'
import { makeKeyTransfer } from './KeyTransfer'

export interface AccessProofConditionContext extends ConditionContext {
    consumer: Account
}

export interface AccessProofConditionExtra {
    data: Buffer
    providerK: string
}

export class AccessProofCondition extends Condition<
    AccessProofConditionContext,
    AccessProofConditionExtra
> {
    public static async getInstance(
        config: InstantiableConfig
    ): Promise<AccessProofCondition> {
        return Condition.getInstance(
            config,
            'AccessProofCondition',
            AccessProofCondition,
            true
        )
    }

    public async paramsFromDDO({ service, consumer }: AccessProofConditionContext) {
        const keytransfer = await makeKeyTransfer()
        const { _hash, _providerPub } = service.attributes.main
        const buyerPub: BabyjubPublicKey = keytransfer.makePublic(
            consumer.babyX!,
            consumer.babyY!
        )
        const providerPub: BabyjubPublicKey = keytransfer.makePublic(
            _providerPub[0],
            _providerPub[1]
        )
        return {
            list: [zeroX(_hash), buyerPub.param(), providerPub.param()],
            params: async ({ data, providerK }) => {
                const cipher = await keytransfer.encryptKey(
                    data,
                    await keytransfer.ecdh(providerK, buyerPub)
                )
                const proof = await keytransfer.prove(
                    buyerPub,
                    providerPub,
                    providerK,
                    data
                )
                const hash = await keytransfer.hashKey(data)
                return [
                    zeroX(_hash),
                    buyerPub.param(),
                    providerPub.param(),
                    cipher,
                    proof,
                    hash
                ]
            }
        }
    }

    public params(hash: string, grantee: BabyjubPublicKey, provider: BabyjubPublicKey) {
        return super.params(zeroX(hash), grantee.param(), provider.param())
    }

    public fulfill(
        agreementId: string,
        origHash: string,
        grantee: BabyjubPublicKey,
        provider: BabyjubPublicKey,
        cipher: MimcCipher,
        proof: string,
        from?: Account,
        params?: TxParameters
    ) {
        return super.fulfillPlain(
            agreementId,
            [
                zeroX(origHash),
                grantee.param(),
                provider.param(),
                cipher.param(),
                zeroX(proof)
            ],
            from,
            params
        )
    }
}
