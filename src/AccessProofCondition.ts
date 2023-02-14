import {
  Account,
  Condition,
  ConditionContext,
  ProviderCondition,
  BabyjubPublicKey,
  MimcCipher,
  zeroX,
  TxParameters,
  InstantiableConfig,
} from '@nevermined-io/sdk'
import { makeKeyTransfer } from './KeyTransfer'

export interface AccessProofConditionContext extends ConditionContext {
  consumer: Account
}

export interface AccessProofConditionExtra {
  data: Buffer
  providerK: string
}

export class AccessProofCondition extends ProviderCondition<
  AccessProofConditionContext,
  AccessProofConditionExtra
> {
  public static async getInstance(config: InstantiableConfig): Promise<AccessProofCondition> {
    return Condition.getInstance(config, 'AccessProofCondition', AccessProofCondition, true)
  }

  public async paramsFromDDO({ service, consumer }: AccessProofConditionContext) {
    const keytransfer = await makeKeyTransfer()
    const { _hash, _providerPub } = service.attributes.main

    const buyerPub: BabyjubPublicKey = keytransfer.makePublic(consumer.babyX!, consumer.babyY!)
    const providerPub: BabyjubPublicKey = keytransfer.makePublic(_providerPub.x, _providerPub.y)
    return {
      list: [zeroX(_hash), buyerPub.param(), providerPub.param()],
      params: async (_method, { data, providerK }) => {
        const cipher = await keytransfer.encryptKey(
          data,
          await keytransfer.ecdh(providerK, buyerPub),
        )
        const proof = await keytransfer.prove(buyerPub, providerPub, providerK, data, this.config)
        return [zeroX(_hash), buyerPub.param(), providerPub.param(), cipher.param(), proof]
      },
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
    params?: TxParameters,
  ): Promise<any> {
    return super.fulfillPlain(
      agreementId,
      [zeroX(origHash), grantee.param(), provider.param(), cipher.param(), zeroX(proof)],
      from,
      params,
    )
  }
}
