import {
  Account,
  Condition,
  ConditionContext,
  ProviderCondition,
  BabyjubPublicKey,
  zeroX,
  TxParameters,
  InstantiableConfig,
  BigNumber,
  ConditionInstanceSmall,
} from '@nevermined-io/sdk'
import { makeKeyTransfer } from './KeyTransfer'
import { makeProof } from './dleq'
import ethers from 'ethers'

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

    const buyerPub: BabyjubPublicKey = keytransfer.makePublic(consumer.babyX!, consumer.babyY!)
    const providerPub: BabyjubPublicKey = keytransfer.makePublic(_providerPub.x, _providerPub.y)
    const secretId: BabyjubPublicKey = keytransfer.makePublic(_secretId.x, _secretId.y)
    return {
      list: [zeroX(_cipherDLEQ), secretId.param(), providerPub.param(), buyerPub.param()],
      params: async (_method, { providerK, agreementId }) => {
        const conditionId = await this.generateIdHash(
          agreementId,
          zeroX(_cipherDLEQ),
          secretId,
          providerPub,
          buyerPub,
        )
        const { reencrypt, proof } = await makeProof(conditionId, providerK, secretId, buyerPub)
        return [
          zeroX(_cipherDLEQ),
          secretId.param(),
          providerPub.param(),
          buyerPub.param(),
          reencrypt.param(),
          proof.param(),
        ]
      },
    }
  }

  public params(
    cipher: string,
    secretId: BabyjubPublicKey,
    provider: BabyjubPublicKey,
    grantee: BabyjubPublicKey,
  ) {
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
      [
        zeroX(cipher),
        secretId.param(),
        provider.param(),
        grantee.param(),
        reencrypt.param(),
        proof.param(),
      ],
      from,
      params,
    )
  }

  public setNetworkPublicKey(key: [string, string], from?: Account, txParams?: TxParameters) {
    return super.send("setNetworkPublicKey", from && from.getId(), [key], txParams)
  }

  public addSecret(key: [string, string], from?: Account, txParams?: TxParameters) {
    return super.send("addSecret", from && from.getId(), [key], txParams)
  }

  public addPrice(pid: string, price: BigNumber, token: string, ttype: number, from?: Account, txParams?: TxParameters) {
    return super.send("addPrice", from && from.getId(), [pid, price, token, ttype], txParams)
  }

  public pointId(key: [string, string]): Promise<string> {
    return super.call("pointId", [key])
  }

  public authorize(agreementId: string, instances: ConditionInstanceSmall[], priceIdx: number, from?: Account, txParams?: TxParameters) {
    const coder = new ethers.utils.AbiCoder()

    const params = [
        coder.encode(
            ['uint', 'uint', 'uint', 'uint', 'uint', 'uint', 'uint'],
            instances[0].list
        ),
        coder.encode(
            ['bytes32', 'address', 'address', 'uint256[]', 'address[]'],
            instances[1].list
        ),
        coder.encode(
            ['bytes32', 'uint256[]', 'address[]', 'address', 'address', 'address', 'bytes32', 'bytes32[]'],
            instances[2].list
        )
    ]

    return super.send('authorizeAgreementTemplate', from && from.getId(), [agreementId, params, priceIdx], txParams)

  }
}
