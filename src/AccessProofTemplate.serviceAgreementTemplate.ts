import { ServiceAgreementTemplate } from '@nevermined-io/nevermined-sdk-js'
import { access, escrowPayment, lockPayment } from './ConditionTemplate'

export const accessTemplateServiceAgreementTemplate: ServiceAgreementTemplate = {
  contractName: 'AccessProofTemplate',
  events: [
    {
      name: 'AgreementCreated',
      actorType: 'consumer',
      handler: {
        moduleName: 'escrowAccessTemplate',
        functionName: 'fulfillLockPaymentCondition',
        version: '0.1',
      },
    },
  ],
  fulfillmentOrder: ['access.fulfill', 'lockPayment.fulfill', 'escrowPayment.fulfill'],
  conditionDependency: {
    lockPayment: [],
    access: [],
    escrowPayment: ['lockPayment', 'access'],
  },
  conditions: [lockPayment, access, escrowPayment],
}
