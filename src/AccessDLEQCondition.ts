import {
  Account,
  Condition,
  ConditionContext,
  ProviderCondition,
  BabyjubPublicKey,
  zeroX,
  TxParameters,
  InstantiableConfig,
} from '@nevermined-io/sdk'
import { makeKeyTransfer } from './KeyTransfer'
import { makeProof } from './dleq'

export interface AccessDLEQConditionContext extends ConditionContext {
  consumer: Account
}

export interface AccessDLEQConditionExtra {
  providerK: string
  agreementId: string
}

export class AccessDLEQCondition extends ProviderCondition<
  AccessDLEQConditionContext,
  AccessDLEQConditionExtra
> {
  public static async getInstance(config: InstantiableConfig): Promise<AccessDLEQCondition> {
    return Condition.getInstance(config, 'AccessDLEQCondition', AccessDLEQCondition, true)
  }

  public async paramsFromDDO({ service, consumer }: AccessDLEQConditionContext) {
    const keytransfer = await makeKeyTransfer()
    const { _secretId, _providerPub, _cipherDLEQ } = service.attributes.main
    console.log(service.attributes.main)

    const buyerPub: BabyjubPublicKey = keytransfer.makePublic(consumer.babyX!, consumer.babyY!)
    const providerPub: BabyjubPublicKey = keytransfer.makePublic(_providerPub.x, _providerPub.y)
    const secretId: BabyjubPublicKey = keytransfer.makePublic(_secretId.x, _secretId.y)
    console.log("args", zeroX(_cipherDLEQ), secretId.param(), providerPub.param(), buyerPub.param())
    return {
      list: [zeroX(_cipherDLEQ), secretId.param(), providerPub.param(), buyerPub.param()],
      params: async (_method, { providerK, agreementId }) => {
        const { reencrypt, proof } = await makeProof(agreementId, providerK, secretId, buyerPub)
        return [zeroX(_cipherDLEQ), secretId.param(), providerPub.param(), reencrypt.param(), proof.param()]
      },
    }
  }

  public params(cipher: string, secretId: BabyjubPublicKey, provider: BabyjubPublicKey, grantee: BabyjubPublicKey) {
    return super.params(zeroX(cipher), secretId.param(), provider.param(), grantee.param())
  }

  public fulfill(
    agreementId: string,
    cipher: string,
    secretId: BabyjubPublicKey,
    provider: BabyjubPublicKey,
    grantee: BabyjubPublicKey,
    reencrypt: BabyjubPublicKey,
    proof: BabyjubPublicKey,
    from?: Account,
    params?: TxParameters,
  ): Promise<any> {
    return super.fulfillPlain(
      agreementId,
      [zeroX(cipher), secretId.param(), provider.param(), grantee.param(), reencrypt.param(), proof.param()],
      from,
      params,
    )
  }
}
