
export const nftHolder = {
    name: 'nftHolder',
    timelock: 0,
    timeout: 0,
    contractName: 'NFT721HolderCondition',
    functionName: 'fulfill',
    parameters: [
        {
            name: '_did',
            type: 'bytes32',
            value: ''
        },
        {
            name: '_holderAddress',
            type: 'address',
            value: ''
        },
        {
            name: '_numberNfts',
            type: 'uint256',
            value: ''
        },
        {
            name: '_contractAddress',
            type: 'address',
            value: ''
        }
    ],
    events: [
        {
            name: 'Fulfilled',
            actorType: 'publisher',
            handler: {
                moduleName: 'nftHolderCondition',
                functionName: 'fulfillNFTHolderCondition',
                version: '0.1'
            }
        }
    ]
}

export const nftHolder721 = {
    name: 'nftHolder',
    timelock: 0,
    timeout: 0,
    contractName: 'NFTHolderCondition',
    functionName: 'fulfill',
    parameters: [
        {
            name: '_did',
            type: 'bytes32',
            value: ''
        },
        {
            name: '_holderAddress',
            type: 'address',
            value: ''
        },
        {
            name: '_numberNfts',
            type: 'uint256',
            value: ''
        },
        {
            name: '_contractAddress',
            type: 'address',
            value: ''
        }
    ],
    events: [
        {
            name: 'Fulfilled',
            actorType: 'publisher',
            handler: {
                moduleName: 'nftHolderCondition',
                functionName: 'fulfillNFTHolderCondition',
                version: '0.1'
            }
        }
    ]
}

export const access = {
    name: 'access',
    timelock: 0,
    timeout: 0,
    contractName: 'AccessProofCondition',
    functionName: 'fulfill',
    parameters: [
        {
        name: '_documentId',
        type: 'bytes32',
        value: ''
        },
        {
        name: '_grantee',
        type: 'uint[2]',
        value: ''
        },
        {
        name: '_provider',
        type: 'uint[2]',
        value: ''
        },
        {
        name: '_cipher',
        type: 'uint[2]',
        value: ''
        },
        {
        name: '_proof',
        type: 'bytes',
        value: ''
        }
    ],
    events: [
        {
          name: 'Fulfilled',
          actorType: 'publisher',
          handler: {
            moduleName: 'access',
            functionName: 'fulfillEscrowPaymentCondition',
            version: '0.1'
          }
        },
        {
          name: 'TimedOut',
          actorType: 'consumer',
          handler: {
            moduleName: 'access',
            functionName: 'fulfillEscrowPaymentCondition',
            version: '0.1'
          }
        }
    ]
}

export const escrowPayment = {
    name: 'escrowPayment',
    timelock: 0,
    timeout: 0,
    contractName: 'EscrowPaymentCondition',
    functionName: 'fulfill',
    parameters: [
      {
        name: '_did',
        type: 'bytes32',
        value: ''
      },
      {
        name: '_amounts',
        type: 'uint256[]',
        value: ''
      },
      {
        name: '_receivers',
        type: 'address[]',
        value: ''
      },
      {
        name: '_sender',
        type: 'address',
        value: ''
      },
      {
        name: '_tokenAddress',
        type: 'address',
        value: ''
      },
      {
        name: '_lockCondition',
        type: 'bytes32',
        value: ''
      },
      {
        name: '_releaseCondition',
        type: 'bytes32',
        value: ''
      }
    ],
    events: [
      {
        name: 'Fulfilled',
        actorType: 'publisher',
        handler: {
          moduleName: 'escrowPaymentCondition',
          functionName: 'verifyRewardTokens',
          version: '0.1'
        }
      }
    ]
}

export const lockPayment = {
    name: 'lockPayment',
    timelock: 0,
    timeout: 0,
    contractName: 'LockPaymentCondition',
    functionName: 'fulfill',
    parameters: [
      {
        name: '_did',
        type: 'bytes32',
        value: ''
      },
      {
        name: '_rewardAddress',
        type: 'address',
        value: ''
      },
      {
        name: '_tokenAddress',
        type: 'address',
        value: ''
      },
      {
        name: '_amounts',
        type: 'uint256[]',
        value: []
      },
      {
        name: '_receivers',
        type: 'address[]',
        value: []
      }
    ],
    events: [
      {
        name: 'Fulfilled',
        actorType: 'publisher',
        handler: {
          moduleName: 'lockPaymentCondition',
          functionName: 'fulfillAccessCondition',
          version: '0.1'
        }
      }
    ]
}

export const transferNFT721 = {
    name: 'transferNFT',
    timelock: 0,
    timeout: 0,
    contractName: 'TransferNFT721Condition',
    functionName: 'fulfill',
    parameters: [
        {
            name: '_documentId',
            type: 'bytes32',
            value: ''
        },
        {
            name: '_receiver',
            type: 'address',
            value: ''
        },
        {
            name: '_numberNfts',
            type: 'uint256',
            value: ''
        },
        {
            name: '_conditionId',
            type: 'bytes32',
            value: ''
        },
        {
            name: '_nftHolder',
            type: 'address',
            value: ''
        },
        {
            name: '_nftTransfer',
            type: 'boolean',
            value: 'false'
        },
        {
            name: '_duration',
            type: 'uint256',
            value: '0'
        },
        {
            name: '_contractAddress',
            type: 'address',
            value: ''
        }
    ],
    events: [
        {
            name: 'Fulfilled',
            actorType: 'publisher',
            handler: {
                moduleName: 'transferNFT',
                functionName: 'fulfillEscrowPaymentCondition',
                version: '0.1'
            }
        },
        {
            name: 'TimedOut',
            actorType: 'consumer',
            handler: {
                moduleName: 'access',
                functionName: 'fulfillEscrowPaymentCondition',
                version: '0.1'
            }
        }
    ]
}

export const transferNFT = {
    name: 'transferNFT',
    timelock: 0,
    timeout: 0,
    contractName: 'TransferNFTCondition',
    functionName: 'fulfill',
    parameters: [
        {
            name: '_documentId',
            type: 'bytes32',
            value: ''
        },
        {
            name: '_receiver',
            type: 'address',
            value: ''
        },
        {
            name: '_numberNfts',
            type: 'uint256',
            value: ''
        },
        {
            name: '_conditionId',
            type: 'bytes32',
            value: ''
        },
        {
            name: '_nftHolder',
            type: 'address',
            value: ''
        },
        {
            name: '_nftTransfer',
            type: 'boolean',
            value: 'false'
        },
        {
            name: '_duration',
            type: 'uint256',
            value: '0'
        },
        {
            name: '_contractAddress',
            type: 'address',
            value: ''
        }
    ],
    events: [
        {
            name: 'Fulfilled',
            actorType: 'publisher',
            handler: {
                moduleName: 'transferNFT',
                functionName: 'fulfillEscrowPaymentCondition',
                version: '0.1'
            }
        },
        {
            name: 'TimedOut',
            actorType: 'consumer',
            handler: {
                moduleName: 'access',
                functionName: 'fulfillEscrowPaymentCondition',
                version: '0.1'
            }
        }
    ]
}
