import { ServiceAgreementTemplate } from '@nevermined-io/sdk'
import { access, accessDLEQ, escrowPayment, lockPayment } from './ConditionTemplate'

export const accessTemplateServiceAgreementTemplate = (): ServiceAgreementTemplate => ({
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
})

export const accessDLEQTemplateServiceAgreementTemplate = (): ServiceAgreementTemplate => ({
  contractName: 'AccessDLEQTemplate',
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
  conditions: [lockPayment, accessDLEQ, escrowPayment],
})
