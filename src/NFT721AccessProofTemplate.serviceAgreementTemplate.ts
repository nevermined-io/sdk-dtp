import { ServiceAgreementTemplate } from '@nevermined-io/sdk'
import { access, nftHolder } from './ConditionTemplate'

export const nft721AccessTemplateServiceAgreementTemplate: ServiceAgreementTemplate = {
  contractName: 'NFT721AccessTemplate',
  events: [
    {
      name: 'AgreementCreated',
      actorType: 'consumer',
      handler: {
        moduleName: 'nft721AccessTemplate',
        functionName: 'fulfillNFTHolderCondition',
        version: '0.1',
      },
    },
  ],
  fulfillmentOrder: ['nftHolder.fulfill', 'nftAccess.fulfill'],
  conditionDependency: {
    nftHolder: [],
    nftAccess: [],
  },
  conditions: [nftHolder, access],
}
