import { MetaData } from '@nevermined-io/nevermined-sdk-js'
import { readFileSync } from 'fs'
import { makeKeyTransfer } from '../src/KeyTransfer'
import { CryptoConfig } from '../src/utils'

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function read(a) {
  if (!a) {
    return ''
  } else {
    return readFileSync(a).toString()
  }
}

export const cryptoConfig: CryptoConfig = {
  provider_key: process.env.PROVIDER_KEY,
  provider_password: read(process.env.PROVIDER_PASSWORD),
  provider_rsa_public: read(process.env.PROVIDER_RSA_PUB),
  provider_rsa_private: read(process.env.PROVIDER_RSA_PRIV)
}

export async function getMetadataForDTP(
  name: string,
  passwd: string,
  providerKey: any
): Promise<MetaData> {
  const keytransfer = await makeKeyTransfer()
  return {
    main: {
      name,
      isDTP: true,
      type: 'dataset',
      dateCreated: '2012-10-10T17:00:00Z',
      datePublished: '2012-10-10T17:00:00Z',
      author: 'Met Office',
      license: 'CC-BY',
      price: '21' + '0'.repeat(18),
      files: [
        {
          index: 1,
          contentType: 'text/plain',
          url: passwd
        }
      ]
    },
    additionalInformation: {
      description: 'Weather information of UK including temperature and humidity',
      copyrightHolder: 'Met Office',
      workExample: '423432fsd,51.509865,-0.118092,2011-01-01T10:55:11+00:00,7.2,68',
      inLanguage: 'en',
      categories: ['Economy', 'Data Science'],
      poseidonHash: await keytransfer.hashKey(Buffer.from(passwd, 'hex')),
      providerKey,
      tags: ['weather', 'uk', '2011', 'temperature', 'humidity']
    }
  }
}
