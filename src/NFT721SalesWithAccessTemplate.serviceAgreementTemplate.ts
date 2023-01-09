import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js'
import { access, escrowPayment, lockPayment, transferNFT721 } from './ConditionTemplate'

export const nft721SalesTemplateServiceAgreementTemplate: ServiceAgreementTemplate = {
  contractName: 'NFT721SalesTemplate',
  events: [
    {
      name: 'AgreementCreated',
      actorType: 'consumer',
      handler: {
        moduleName: 'nft721SalesTemplate',
        functionName: 'fulfillLockPaymentCondition',
        version: '0.1',
      },
    },
  ],
  fulfillmentOrder: ['lockPayment.fulfill', 'transferNFT.fulfill', 'escrowPayment.fulfill'],
  conditionDependency: {
    lockPayment: [],
    transferNFT: [],
    escrowPayment: ['lockPayment', 'transferNFT'],
  },
  conditions: [lockPayment, transferNFT721, escrowPayment, access],
}
