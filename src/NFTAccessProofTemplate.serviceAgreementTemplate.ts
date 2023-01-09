import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js'
import { access, nftHolder } from './ConditionTemplate'

export const nftAccessTemplateServiceAgreementTemplate: ServiceAgreementTemplate = {
  contractName: 'NFTAccessTemplate',
  events: [
    {
      name: 'AgreementCreated',
      actorType: 'consumer',
      handler: {
        moduleName: 'nftAccessTemplate',
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
