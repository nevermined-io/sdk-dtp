import { Account, MetaData, MetaDataMain } from '@nevermined-io/nevermined-sdk-js';
import {
  ServiceAccess,
  ServiceNFTAccess,
  ServiceNFTSales,
  ServicePlugin,
  ValidationParams,
} from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service';
import {
  Instantiable,
  InstantiableConfig,
} from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import { TxParameters } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/ContractBase';
import AssetRewards from '@nevermined-io/nevermined-sdk-js/dist/node/models/AssetRewards';
import {
  NFTAccessService,
  NFTSalesService,
} from '@nevermined-io/nevermined-sdk-js/dist/node/nevermined/AccessService';
import { NFT721AccessProofTemplate } from './NFT721AccessProofTemplate';
import { NFT721SalesWithAccessTemplate } from './NFT721SalesWithAccessTemplate';
import { NFTAccessProofTemplate } from './NFTAccessProofTemplate';
import { NFTSalesWithAccessTemplate } from './NFTSalesWithAccessTemplate';

export type ServiceAccessProof = ServiceAccess & {
  attributes: {
    main: {
      _hash: string;
      _providerPub: { x: string; y: string };
    };
  };
};

export type ServiceNFTAccessProof = ServiceNFTAccess & {
  attributes: {
    main: {
      _hash: string;
      _providerPub: { x: string; y: string };
    };
  };
};

export type ServiceNFTSalesProof = ServiceNFTSales & {
  attributes: {
    main: {
      _hash: string;
      _providerPub: { x: string; y: string };
    };
  };
};

export class NFTAccessProofService extends Instantiable
  implements ServicePlugin<ServiceNFTAccessProof | ServiceNFTAccess> {
  normal: NFTAccessService;
  proof: NFTAccessProofTemplate;
  proof721?: NFT721AccessProofTemplate;

  constructor(
    config: InstantiableConfig,
    proof: NFTAccessProofTemplate,
    proof721: NFT721AccessProofTemplate,
  ) {
    super();
    this.setInstanceConfig(config);
    this.normal = new NFTAccessService(config);
    this.proof = proof;
    this.proof721 = proof721;
  }

  public async createService(
    publisher: Account,
    metadata: MetaData,
    assetRewards: AssetRewards,
    erc20TokenAddress: string,
  ) {
    return this.select(metadata.main).createService(
      publisher,
      metadata,
      assetRewards,
      erc20TokenAddress,
      false,
    );
  }

  // essential method is to select between two services
  public select(main: MetaDataMain): ServicePlugin<ServiceNFTAccess | ServiceNFTAccessProof> {
    if (!this.isDTP(main)) {
      return this.normal.select(main);
    }
    return main.ercType === 1155 ? this.proof : this.proof721;
  }

  public async process(
    params: ValidationParams,
    from: Account,
    txparams?: TxParameters,
  ): Promise<void> {
    const ddo = await this.nevermined.assets.resolve(params.did);
    const metadata = ddo.findServiceByType('metadata').attributes.main;
    return this.select(metadata).process(params, from, txparams);
  }
  public async accept(params: ValidationParams): Promise<boolean> {
    const ddo = await this.nevermined.assets.resolve(params.did);
    const metadata = ddo.findServiceByType('metadata').attributes.main;
    return this.select(metadata).accept(params);
  }

  private isDTP(main: MetaDataMain): boolean {
    return main.files && main.files.some((f) => f.encryption === 'dtp');
  }
}

export class NFTSalesProofService extends Instantiable
  implements ServicePlugin<ServiceNFTSales | ServiceNFTSalesProof> {
  normal: NFTSalesService;
  proof: NFTSalesWithAccessTemplate;
  proof721?: NFT721SalesWithAccessTemplate;

  constructor(
    config: InstantiableConfig,
    proof: NFTSalesWithAccessTemplate,
    proof721: NFT721SalesWithAccessTemplate,
  ) {
    super();
    this.setInstanceConfig(config);
    this.normal = new NFTSalesService(config);
    this.proof = proof;
    this.proof721 = proof721;
  }

  public async createService(
    publisher: Account,
    metadata: MetaData,
    assetRewards: AssetRewards,
    erc20TokenAddress: string,
  ): Promise<ServiceNFTSales | ServiceNFTSalesProof> {
    return this.select(metadata.main).createService(
      publisher,
      metadata,
      assetRewards,
      erc20TokenAddress,
      true,
    );
  }

  // essential method is to select between two services
  public select(main: MetaDataMain): ServicePlugin<ServiceNFTSales | ServiceNFTSalesProof> {
    if (!this.isDTP(main)) {
      return this.normal.select(main);
    }
    return main.ercType === 1155 ? this.proof : this.proof721;
  }

  public async process(
    params: ValidationParams,
    from: Account,
    txparams?: TxParameters,
  ): Promise<void> {
    const ddo = await this.nevermined.assets.resolve(params.did);
    const metadata = ddo.findServiceByType('metadata').attributes.main;
    return this.select(metadata).process(params, from, txparams);
  }
  public async accept(params: ValidationParams): Promise<boolean> {
    const ddo = await this.nevermined.assets.resolve(params.did);
    const metadata = ddo.findServiceByType('metadata').attributes.main;
    return this.select(metadata).accept(params);
  }

  private isDTP(main: MetaDataMain): boolean {
    return main.files && main.files.some((f) => f.encryption === 'dtp');
  }
}