import { MetaData } from '@nevermined-io/sdk'
import { readFileSync } from 'fs'
import { makeKeyTransfer, CryptoConfig } from '../src'

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function read(a) {
  if (!a) {
    return ''
  } else {
    return readFileSync(a).toString()
  }
}

export const cryptoConfig: CryptoConfig = {
  provider_key: process.env.PROVIDER_KEY as string,
  provider_password: read(process.env.PROVIDER_PASSWORD),
  provider_rsa_public: read(process.env.PROVIDER_RSA_PUB),
  provider_rsa_private: read(process.env.PROVIDER_RSA_PRIV),
}

export async function getMetadataForDTP(
  name: string,
  passwd: string,
  providerKey: any,
): Promise<MetaData> {
  const keytransfer = await makeKeyTransfer()
  return {
    main: {
      name,
      type: 'dataset',
      dateCreated: '2012-10-10T17:00:00Z',
      datePublished: '2012-10-10T17:00:00Z',
      author: 'Met Office',
      license: 'CC-BY',
      files: [
        {
          index: 1,
          contentType: 'text/plain',
          url: passwd,
          encryption: 'dtp',
        },
      ],
    },
    additionalInformation: {
      description: 'Weather information of UK including temperature and humidity',
      copyrightHolder: 'Met Office',
      workExample: '423432fsd,51.509865,-0.118092,2011-01-01T10:55:11+00:00,7.2,68',
      inLanguage: 'en',
      categories: ['Economy', 'Data Science'],
      poseidonHash: await keytransfer.hashKey(Buffer.from(passwd, 'hex')),
      providerKey,
      tags: ['weather', 'uk', '2011', 'temperature', 'humidity'],
    },
  }
}

export async function getMetadataForDLEQ(
  name: string,
  cipher: string,
  providerKey: any,
  secretId: any,
): Promise<MetaData> {
  return {
    main: {
      name,
      type: 'dataset',
      dateCreated: '2012-10-10T17:00:00Z',
      datePublished: '2012-10-10T17:00:00Z',
      author: 'Met Office',
      license: 'CC-BY',
      files: [
        {
          index: 1,
          contentType: 'text/plain',
          url: cipher,
          encryption: 'dleq',
        },
      ],
    },
    additionalInformation: {
      description: 'Weather information of UK including temperature and humidity',
      copyrightHolder: 'Met Office',
      workExample: '423432fsd,51.509865,-0.118092,2011-01-01T10:55:11+00:00,7.2,68',
      inLanguage: 'en',
      categories: ['Economy', 'Data Science'],
      cipher,
      secretId,
      providerKey,
      tags: ['weather', 'uk', '2011', 'temperature', 'humidity'],
    },
  }
}
