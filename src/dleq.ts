import { BabyjubPublicKey } from "@nevermined-io/sdk"

const { ethers } = require('ethers')

function bigToHex(a) {
    let str = a.toString(16)
    while (str.length < 64) {
      str = '0' + str
    }
    return '0x' + str
}

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

    const objR = G1.toObject(G1.toAffine(yR))

    return {
        proof: new BabyjubPublicKey('0x'+Fr.toObject(e).toString(16), '0x'+Fr.toObject(f).toString(16)),
        reencrypt: new BabyjubPublicKey('0x'+objR[0].toString(16), '0x'+objR[1].toString(16)),
    }

}

export async function checkProof(agreementId: string, buyerK: string, secretId: BabyjubPublicKey, providerPub: BabyjubPublicKey, proof: BabyjubPublicKey, reencrypt: BabyjubPublicKey) {
    const { buildBn128 } = require('ffjavascript')
    const ffCurve = await buildBn128()
    const G1 = ffCurve.G1
    const Fr = ffCurve.Fr

    const G = G1.g

    function toEvm(p) {
        const obj = G1.toObject(G1.toAffine(p))
        return [obj[0].toString(10), obj[1].toString(10)]
    }

    const z = Fr.fromObject(BigInt(buyerK))
    const zG = G1.timesFr(G, z)
    const label = agreementId

    const xG =  G1.fromObject([BigInt(secretId.x), BigInt(secretId.y)]) // secret id, get from x, y
    const yG =  G1.fromObject([BigInt(providerPub.x), BigInt(providerPub.y)]) // provider pub, get from x, y

    const R = G1.add(xG, zG)
    const yR =  G1.fromObject([BigInt(reencrypt.x), BigInt(reencrypt.y)]) // reencryption, get from x, y

    const e = Fr.fromObject(BigInt(proof.x))
    const f = Fr.fromObject(BigInt(proof.y))

    // w1 = f*G + yG * e
    const ww1 = G1.add(G1.timesFr(G, f), G1.timesFr(yG, e))
    // w2 = f*R + yR * e
    const ww2 = G1.add(G1.timesFr(R, f), G1.timesFr(yR, e))

    const arr2 = [label].concat(toEvm(yG)).concat(toEvm(yR)).concat(toEvm(ww1)).concat(toEvm(ww2))
    const chal = Fr.fromObject(BigInt(ethers.utils.solidityKeccak256(arr2.map(a => 'uint256'), arr2)))
    
    return Fr.eq(chal, e)

}

async function secretToPublic(secret: string): Promise<BabyjubPublicKey> {
    const { buildBn128 } = require('ffjavascript')
    const ffCurve = await buildBn128()
    const G1 = ffCurve.G1
    const Fr = ffCurve.Fr

    const G = G1.g

    const y = Fr.fromObject(BigInt(secret))
    const yG = G1.timesFr(G, y)
    const objR = G1.toObject(G1.toAffine(yG))
    return new BabyjubPublicKey(bigToHex(objR[0]), bigToHex(objR[1]))
}

async function encrypt(passwd: bigint, secret: string, providerPub: BabyjubPublicKey): Promise<bigint> {
    const { buildBn128 } = require('ffjavascript')
    const ffCurve = await buildBn128()
    const G1 = ffCurve.G1
    const Fr = ffCurve.Fr

    const G = G1.g

    const yG = G1.fromObject([BigInt(providerPub.x), BigInt(providerPub.y)])
    const x = Fr.fromObject(BigInt(secret))
    const xG = G1.timesFr(G, x)

    // Compute ECDH
    const ecdh = G1.timesFr(yG, x)
    const objR = G1.toObject(G1.toAffine(ecdh))

    const mask = objR[0]
    return passwd ^ mask
}

async function decrypt(cipher: string, buyerK: string, reencrypt: [string, string], providerPub: BabyjubPublicKey): Promise<bigint> {
    const { buildBn128 } = require('ffjavascript')
    const ffCurve = await buildBn128()
    const G1 = ffCurve.G1
    const Fr = ffCurve.Fr

    const G = G1.g

    const yG = G1.fromObject([BigInt(providerPub.x), BigInt(providerPub.y)])
    const yR = G1.fromObject([BigInt(reencrypt[0]), BigInt(reencrypt[1])])
    const z = Fr.fromObject(BigInt(buyerK))
    const zG = G1.timesFr(G, z)

    // Compute ECDH (reencrypted)
    const R = G1.add(yR, G1.neg(G1.timesFr(yG, z)))
    const objR = G1.toObject(G1.toAffine(R))

    const mask = objR[0]
    return BigInt(cipher) ^ mask
}

export const dleq = {
    makeProof,
    checkProof,
    secretToPublic,
    encrypt,
    decrypt,
    bigToHex,
}

