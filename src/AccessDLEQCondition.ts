import {
  Account,
  Condition,
  ConditionContext,
  ProviderCondition,
  BabyjubPublicKey,
  zeroX,
  TxParameters,
  InstantiableConfig,
  ConditionInstanceSmall,
} from '@nevermined-io/sdk'
import { makeKeyTransfer } from './KeyTransfer'
import { makeProof } from './dleq'
import { ethers } from 'ethers'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async setNetworkPublicKey(key: BabyjubPublicKey, from?: Account, txParams?: TxParameters): Promise<any> {
    return super.send("setNetworkPublicKey", from && from.getId(), [[key.x, key.y]], txParams)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async addSecret(key: BabyjubPublicKey, from?: Account, txParams?: TxParameters): Promise<any> {
    return super.send("addSecret", from && from.getId(), [[key.x, key.y]], txParams)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async addPrice(pid: string, price: bigint, token: string, ttype: number, from?: Account, txParams?: TxParameters): Promise<any> {
    return super.send("addPrice", from && from.getId(), [pid, price, token, ttype], txParams)
  }

  public pointId(key: BabyjubPublicKey): Promise<string> {
    return super.call("pointId", [[key.x, key.y]])
  }

  public async networkKey(): Promise<BabyjubPublicKey> {
    const res0 = await super.call("network", [0])
    const res1 = await super.call("network", [1])
    return new BabyjubPublicKey((res0 as any)._hex, (res1 as any)._hex)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public authorize(agreementId: string, instances: ConditionInstanceSmall[], priceIdx: number, from?: Account, txParams?: TxParameters): Promise<any> {
    const coder = new ethers.utils.AbiCoder()

    const l2 = instances[2].list
    const params = [
      coder.encode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [instances[0].list[0], instances[0].list[1][0], instances[0].list[1][1], instances[0].list[2][0], instances[0].list[2][1], instances[0].list[3][0], instances[0].list[3][1]]
      ),
      coder.encode(
        ['bytes32', 'address', 'address', 'uint256[]', 'address[]'],
        instances[1].list
      ),
      coder.encode(
        ['bytes32', 'uint256[]', 'address[]', 'address', 'address', 'address', 'bytes32', 'bytes32[]'],
        [l2[0], l2[1], l2[2], l2[3], l2[4], l2[5], l2[6], [l2[7]]]
      )
    ]

    return super.send('authorizeAccessTemplate', from && from.getId(), [agreementId, params, priceIdx], txParams)

  }
}
