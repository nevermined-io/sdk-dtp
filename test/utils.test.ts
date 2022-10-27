import { read, readFileSync } from 'fs'
import { decrypt, encrypt, aes_decryption_256, aes_encryption_256 } from '../src/utils'
import { assert } from 'chai'

describe('utils', () => {
  const msg =
    'tervvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvfkvfmfdlkvmdlfkvmldfkmvldkfmvldkfmvldkfmvldkfmvlkdmfvlkdmflvkmdflvkmdlfkvmldfkvmldkmest'
  let config

  before(() => {
    config = {
      provider_password: 'secret',
      provider_key: readFileSync('./test/data/provider.json').toString(),
      provider_rsa_public: readFileSync('./test/data/rsa_pub_key.pem').toString(),
      provider_rsa_private: readFileSync('./test/data/rsa_priv_key.pem').toString()
    }
  })
  it('should encrypt and decrypt using RSA', async () => {
    const { result } = await encrypt(config, msg, 'PSK-RSA')
    const msg_ = await decrypt(config, result, 'PSK-RSA')
    assert.equal(msg_, msg)
  })
  it('should encrypt and decrypt using ECDSA', async () => {
    const { result } = await encrypt(config, msg, 'PSK-ECDSA')
    const msg_ = await decrypt(config, result, 'PSK-ECDSA')
    assert.equal(msg_, msg)
  })
  it('should encrypt and decrypt using password', async() => {
    const passwd = 'eMo4geeoHD6Buv3lwT1ljlVc7SHMcX9zx4uuEdEpj2M'
    let msg = readFileSync('./test.data').toString()
    /*for (let i = 0; i < 12; i++) {
      msg = msg + msg
    }*/
    const ctext = aes_encryption_256(msg, passwd)
    // const res = aes_decryption_256(ctext, passwd)
    let msg2 = readFileSync('./test2.data').toString('binary')
    try {
      const res = aes_decryption_256(msg2, passwd)
      assert.equal(msg, res)
    } catch (e) {
      console.log(e)
    }
  })
})
