import { BabyjubPublicKey, MimcCipher, Babysig, NeverminedOptions } from '@nevermined-io/sdk'
import Web3Utils from 'web3-utils'
import vKey from './verification_key.json'

const SEED = 'mimcsponge'
const NROUNDS = 220

class Circom {
  private babyjub
  private poseidon
  private mimcsponge

  /* eslint-disable @typescript-eslint/no-var-requires */
  public async init() {
    this.babyjub = await require('circomlibjs').buildBabyjub()
    this.poseidon = await require('circomlibjs').buildPoseidonReference()
    this.mimcsponge = await require('circomlibjs').buildMimcSponge()
  }

  public getBabyjub() {
    return this.babyjub
  }

  public getPoseidon() {
    return this.poseidon
  }

  public getMimcSponge() {
    return this.mimcsponge
  }
}

export class KeyTransfer {
  cts
  F
  snarkjs
  ffjavascript
  circom: Circom

  public async init() {
    this.snarkjs = require('snarkjs')
    this.ffjavascript = require('ffjavascript')
    this.circom = new Circom()
    await this.circom.init()

    this.F = this.circom.getPoseidon().F

    this.cts = this.getConstants(SEED, NROUNDS)
  }

  private getConstants(seed, nRounds) {
    if (typeof seed === 'undefined') seed = SEED
    if (typeof nRounds === 'undefined') nRounds = NROUNDS
    const cts = new Array(nRounds)
    let c = Web3Utils.keccak256(SEED)
    for (let i = 1; i < nRounds; i++) {
      c = Web3Utils.keccak256(c)

      const n1 = Web3Utils.toBN(c).mod(Web3Utils.toBN(this.F.p.toString()))
      const c2 = Web3Utils.padLeft(Web3Utils.toHex(n1), 64)
      cts[i] = this.F.e(Web3Utils.toBN(c2).toString())
    }
    cts[0] = this.F.e(0)
    cts[cts.length - 1] = this.F.e(0)
    return cts
  }

  private decrypt(xLin, xRin, kin) {
    let xL = this.F.e(xLin)
    let xR = this.F.e(xRin)
    const k = this.F.e(kin)
    for (let i = 0; i < NROUNDS; i++) {
      const c = this.cts[NROUNDS - 1 - i]
      const t = i === 0 ? this.F.add(xL, k) : this.F.add(this.F.add(xL, k), c)
      const xRtmp = this.F.e(xR)
      if (i < NROUNDS - 1) {
        xR = xL
        xL = this.F.sub(xRtmp, this.F.exp(t, 5))
      } else {
        xR = this.F.sub(xRtmp, this.F.exp(t, 5))
      }
    }
    return {
      xL,
      xR,
    }
  }

  // mnemonic to secret key

  public makeKey(str: string) {
    const c = Web3Utils.keccak256(str)
    return c.substr(0, 60)
  }

  public makePublic(x: string, y: string) {
    return new BabyjubPublicKey(x, y)
  }

  public async secretToPublic(secret: string): Promise<BabyjubPublicKey> {
    const babyjub = await this.circom.getBabyjub()

    const [x, y] = babyjub.mulPointEscalar(babyjub.Base8, BigInt(secret))
    return new BabyjubPublicKey(this.toHex(x), this.toHex(y))
  }

  public async signBabyjub(provider_secret, msg): Promise<Babysig> {
    const babyjub = this.circom.getBabyjub()
    const poseidon = this.circom.getPoseidon()

    let r = BigInt(this.makeKey(provider_secret + 'a'))
    const { subOrder } = babyjub
    const base8 = babyjub.Base8
    const F = babyjub.p
    r = r % subOrder
    const s = BigInt(this.makeKey(provider_secret))
    const R8 = babyjub.mulPointEscalar(base8, r)
    const A = babyjub.mulPointEscalar(base8, s)
    const hm = this.F.toObject(poseidon([R8[0], R8[1], A[0], A[1], msg % F]))
    const S = (r + hm * s) % subOrder
    return {
      R8: [this.toHex(R8[0]), this.toHex(R8[1])],
      S: this.bigToHex(S),
    }
  }

  public async verifyBabyjub(pubkey: BabyjubPublicKey, msg, sig: Babysig): Promise<boolean> {
    const babyjub = this.circom.getBabyjub()
    const poseidon = this.circom.getPoseidon()

    const base8 = babyjub.Base8
    const order = 21888242871839275222246405745257275088614511777268538073601725287587578984328n
    const subOrder = order / 8n
    const F = babyjub.p

    // these should be hex numbers
    const sig_R8 = [this.F.e(sig.R8[0]), this.F.e(sig.R8[1])]
    const sig_S = BigInt(sig.S)
    const A = [this.F.e(pubkey.x), this.F.e(pubkey.y)]
    if (!babyjub.inCurve(sig_R8)) return false
    if (!babyjub.inCurve(A)) return false
    if (BigInt(sig.S) >= subOrder) return false

    const hm = this.F.toObject(poseidon([sig_R8[0], sig_R8[1], A[0], A[1], msg % F]))

    const Pleft = babyjub.mulPointEscalar(base8, sig_S * 8n)
    const Pright_ = babyjub.mulPointEscalar(A, hm * 8n)
    const Pright = babyjub.addPoint(babyjub.mulPointEscalar(sig_R8, 8n), Pright_)

    if (this.F.toObject(Pleft[0]) != this.F.toObject(Pright[0])) return false
    if (this.F.toObject(Pleft[1]) != this.F.toObject(Pright[1])) return false
    return true
  }

  // generate hash from plain text key
  // Buffer should have 32 elems
  public async hashKey(a: Buffer) {
    const poseidon = this.circom.getPoseidon()
    const hash = poseidon(this.split(a))
    return this.arrayToHex(hash)
  }

  public async ecdh(secret: string, pub: BabyjubPublicKey): Promise<string> {
    const babyjub = this.circom.getBabyjub()

    const [x, _y] = babyjub.mulPointEscalar([this.F.e(pub.x), this.F.e(pub.y)], BigInt(secret))
    return this.toHex(x)
  }

  public async encryptKey(a: Buffer, secret: string): Promise<MimcCipher> {
    const mimcsponge = this.circom.getMimcSponge()

    const [left, right] = this.split(a)
    const { xL, xR } = mimcsponge.hash(left, right, BigInt(secret))
    return new MimcCipher(this.toHex(xL), this.toHex(xR))
  }

  public decryptKey(a: MimcCipher, secret: string): Buffer {
    const { xL, xR } = this.decrypt(BigInt(a.x), BigInt(a.y), BigInt(secret))
    return Buffer.from(this.toHex(xL).substr(34) + this.toHex(xR).substr(34), 'hex')
  }

  public async prove(
    buyerPub: BabyjubPublicKey,
    providerPub: BabyjubPublicKey,
    providerK: string,
    data: Buffer,
    config: NeverminedOptions,
  ): Promise<string> {
    const mimcsponge = this.circom.getMimcSponge()
    const poseidon = this.circom.getPoseidon()
    const [orig1, orig2] = this.split(data)

    const k = await this.ecdh(providerK, buyerPub)
    const cipher = mimcsponge.hash(orig1, orig2, k)
    const origHash = poseidon([orig1, orig2])
    const { F } = this

    function conv(x) {
      const res = F.toObject(x)
      return res
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    const snarkParams = {
      xL_in: orig1,
      xR_in: orig2,
      provider_k: BigInt(providerK),
      buyer_x: BigInt(buyerPub.x),
      buyer_y: BigInt(buyerPub.y),
      provider_x: BigInt(providerPub.x),
      provider_y: BigInt(providerPub.y),
      cipher_xL_in: conv(cipher.xL),
      cipher_xR_in: conv(cipher.xR),
      hash_plain: conv(origHash),
    }

    const { proof } = await this.snarkjs.plonk.fullProve(
      snarkParams,
      `${config.circuitsFolder}/keytransfer.wasm`,
      `${config.circuitsFolder}/keytransfer.zkey`,
    )

    const signals = [
      this.F.e(buyerPub.x),
      this.F.e(buyerPub.y),
      this.F.e(providerPub.x),
      this.F.e(providerPub.y),
      cipher.xL,
      cipher.xR,
      origHash,
    ]

    const proofSolidity = await this.snarkjs.plonk.exportSolidityCallData(
      this.ffjavascript.utils.unstringifyBigInts(proof),
      signals,
    )

    const proofData = proofSolidity.split(',')[0]
    return proofData
  }

  public async verify(
    buyerPub: BabyjubPublicKey,
    providerPub: BabyjubPublicKey,
    providerK: string,
    data: Buffer,
    proof: any,
  ): Promise<string> {
    const mimcsponge = await this.circom.getMimcSponge()
    const poseidon = await this.circom.getPoseidon()
    const [orig1, orig2] = this.split(data)
    const k = this.ecdh(providerK, buyerPub)
    const cipher = mimcsponge.mimcjs.hash(orig1, orig2, k)
    const origHash = poseidon([orig1, orig2])
    const signals = [
      buyerPub.x,
      buyerPub.y,
      providerPub.x,
      providerPub.y,
      cipher.xL,
      cipher.xR,
      origHash,
    ]

    const res = await this.snarkjs.plonk.verify(vKey, signals, proof)

    return res
  }

  private bigToHex(a) {
    let str = a.toString(16)
    while (str.length < 64) {
      str = '0' + str
    }
    return '0x' + str
  }

  private toHex(a) {
    return this.arrayToHex(a)
  }

  private arrayToHex(a: Uint8Array): string {
    let str = this.F.toObject(a).toString(16)
    while (str.length < 64) {
      str = '0' + str
    }
    return '0x' + str
  }

  private split(a: Buffer) {
    const str = a.toString('hex')
    const left = BigInt('0x' + str.substr(0, 32))
    const right = BigInt('0x' + str.substr(32, 32))
    return [left, right]
  }
}

export async function makeKeyTransfer() {
  const res = new KeyTransfer()
  await res.init()
  return res
}
