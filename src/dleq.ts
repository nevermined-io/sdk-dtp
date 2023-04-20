import { BabyjubPublicKey } from "@nevermined-io/sdk"

const { ethers } = require('ethers')

export async function makeProof(agreementId: string, providerK: string, secretId: BabyjubPublicKey, buyerPub: BabyjubPublicKey) {
    const { buildBn128 } = require('ffjavascript')
    const ffCurve = await buildBn128()
    const G1 = ffCurve.G1
    const Fr = ffCurve.Fr

    const G = G1.g

    const y = Fr.fromObject(BigInt(providerK))
    const yG = G1.timesFr(G, y)
    const label = agreementId

    const xG =  G1.fromObject([BigInt(secretId.x), BigInt(secretId.y)]) // secret id, get from x, y
    const zG =  G1.fromObject([BigInt(buyerPub.x), BigInt(buyerPub.y)]) // buyer pub, get from x, y

    function toEvm(p) {
        const obj = G1.toObject(G1.toAffine(p))
        return [obj[0].toString(10), obj[1].toString(10)]
    }

    const R = G1.add(xG, zG)
    const yR = G1.timesFr(R, y)

    // DLEQ prove, yG == yR
    const t = Fr.random()
    const w1 = G1.timesFr(G, t)
    const w2 = G1.timesFr(R, t)

    const arr = [label].concat(toEvm(yG)).concat(toEvm(yR)).concat(toEvm(w1)).concat(toEvm(w2))
    const e = Fr.fromObject(BigInt(ethers.utils.solidityKeccak256(arr.map(a => 'uint256'), arr)))
    const f = Fr.add(t, Fr.neg(Fr.mul(y, e)))

    const objR = G1.toObject(G1.toAffine(R))

    return {
        proof: new BabyjubPublicKey(Fr.toObject(e).toString(16), Fr.toObject(f).toString(16)),
        reencrypt: new BabyjubPublicKey(objR[0].toString(16), objR[1].toString(16)),
    }

}

