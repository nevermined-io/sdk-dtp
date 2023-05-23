import { ServiceAgreementTemplate } from '@nevermined-io/sdk'
import { access, accessDLEQ, escrowPayment, lockPayment, transferNFT } from './ConditionTemplate'

export const nftSalesTemplateServiceAgreementTemplate: ServiceAgreementTemplate = {
  contractName: 'NFTSalesTemplate',
  events: [
    {
      name: 'AgreementCreated',
      actorType: 'consumer',
      handler: {
        moduleName: 'nftSalesTemplate',
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
  conditions: [lockPayment, transferNFT, escrowPayment, access],
}

export const nftSalesTemplateServiceAgreementTemplateDLEQ: ServiceAgreementTemplate = {
  contractName: 'NFTSalesTemplate',
  events: [
    {
      name: 'AgreementCreated',
      actorType: 'consumer',
      handler: {
        moduleName: 'nftSalesTemplate',
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
  conditions: [lockPayment, transferNFT, escrowPayment, accessDLEQ],
}
