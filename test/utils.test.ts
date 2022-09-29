import { readFileSync } from 'fs'
import { decrypt, encrypt } from '../src/utils'
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
})
