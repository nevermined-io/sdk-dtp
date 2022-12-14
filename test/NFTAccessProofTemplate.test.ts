import { assert } from 'chai';
import { decodeJwt } from 'jose';
import { config } from './config';
import { Nevermined, Account, DDO, Logger } from '@nevermined-io/nevermined-sdk-js';
import { BabyjubPublicKey } from '@nevermined-io/nevermined-sdk-js/dist/node/models/KeyTransfer';
import { generateId } from '@nevermined-io/nevermined-sdk-js/dist/node/utils';

import { Dtp } from '../src/Dtp';
import { AccessProofConditionExtra } from '../src/AccessProofCondition';
import { KeyTransfer, makeKeyTransfer } from '../src/KeyTransfer';
import { cryptoConfig, getMetadataForDTP } from './utils';
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import BigNumber from '@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber';
import {
  NFTAccessProofTemplate,
  NFTAccessProofTemplateParams,
} from '../src/NFTAccessProofTemplate';
import { AgreementInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates';
import { ConditionInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions';
import AssetPrice from '@nevermined-io/nevermined-sdk-js/dist/node/models/AssetPrice';
import { NFTAttributes } from '@nevermined-io/nevermined-sdk-js/dist/node/models/NFTAttributes';
import { Nft1155Contract } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/Nft1155Contract';

describe('NFT Access Proof Template', () => {
  let nevermined: Nevermined;

  let accessProofTemplate: NFTAccessProofTemplate;

  const totalAmount = BigNumber.from(12);
  const amounts = [BigNumber.from(10), BigNumber.from(2)];
  let nftContract: Nft1155Contract;

  let publisher: Account;
  let consumer: Account;
  let provider: Account;
  let receivers: string[];

  let dtp: Dtp;

  before(async () => {
    nevermined = await Nevermined.getInstance(config);

    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined,
    };

    dtp = await Dtp.getInstance(instanceConfig, cryptoConfig);
    accessProofTemplate = dtp.nftAccessProofTemplate;
    nftContract = nevermined.keeper.nftUpgradeable;

    // Accounts
    [, publisher, consumer, provider] = await nevermined.accounts.list();

    receivers = [publisher.getId(), provider.getId()];
  });

  describe('Short flow', () => {
    let agreementId, agreementIdSeed: string;
    let ddo: DDO;

    let buyerK: string;
    let providerK: string;
    let buyerPub: BabyjubPublicKey;
    let providerPub: BabyjubPublicKey;
    let keyTransfer: KeyTransfer;

    let agreementData: AgreementInstance<NFTAccessProofTemplateParams>;

    const providerKey = {
      x: '0x2e3133fbdaeb5486b665ba78c0e7e749700a5c32b1998ae14f7d1532972602bb',
      y: '0x0b932f02e59f90cdd761d9d5e7c15c8e620efce4ce018bf54015d68d9cb35561',
    };

    const origPasswd = 'passwd_32_letters_1234567890asdf';
    const data = Buffer.from(origPasswd);

    let metadata;

    before(async () => {
      metadata = await getMetadataForDTP('foo' + Math.random(), data.toString('hex'), providerKey);

      const clientAssertion = await nevermined.utils.jwt.generateClientAssertion(publisher);

      await nevermined.services.marketplace.login(clientAssertion);

      const payload = decodeJwt(config.marketplaceAuthToken);
      metadata.userId = payload.sub;

      const assetPrice = new AssetPrice(
        new Map([
          [receivers[0], amounts[0]],
          [receivers[1], amounts[1]],
        ]),
      );
      agreementIdSeed = generateId();

      const nftAttributes = NFTAttributes.getNFT1155Instance({
        metadata,
        price: assetPrice,
        serviceTypes: ['nft-sales', 'nft-access'],
        nftContractAddress: nftContract.address,
        cap: BigNumber.from(100),
        amount: BigNumber.from(20)
      })            
      ddo = await nevermined.nfts1155.create(
          nftAttributes,
          publisher
      )

      // ddo = await nevermined.assets.createNft(
      //   metadata,
      //   publisher,
      //   assetPrice,
      //   undefined,
      //   BigNumber.from(100),
      //   undefined,
      //   BigNumber.from(20),
      //   undefined,
      //   undefined,
      //   undefined,
      //   undefined,
      //   undefined,
      //   ['nft-access'],
      // );

      keyTransfer = await makeKeyTransfer();
      buyerK = await keyTransfer.makeKey('abd');
      buyerPub = await keyTransfer.secretToPublic(buyerK);
      providerK = await keyTransfer.makeKey('abc');
      providerPub = await keyTransfer.secretToPublic(providerK);
      consumer.babyX = buyerPub.x;
      consumer.babyY = buyerPub.y;
      consumer.babySecret = buyerK;
    });

    it('should create a new agreement (short way)', async () => {
      const params = accessProofTemplate.params(consumer, publisher.getId(), BigNumber.from(1));
      agreementId = await accessProofTemplate.createAgreementFromDDO(
        agreementIdSeed,
        ddo,
        params,
        consumer,
        publisher,
      );
      agreementData = await accessProofTemplate.instanceFromDDO(
        agreementIdSeed,
        ddo,
        publisher.getId(),
        params,
      );

      assert.match(agreementId, /^0x[a-f0-9]{64}$/i);
    });

    it('should fulfill the conditions from consumer side', async () => {
      try {
        await consumer.requestTokens(totalAmount);
      } catch (error) {
        Logger.error(error);
      }

      await nevermined.keeper.conditions.nftHolderCondition.fulfillInstance(
        agreementData.instances[0] as ConditionInstance<any>,
        {},
      );
    });

    it('should fulfill the conditions from publisher side', async () => {
      const extra: AccessProofConditionExtra = {
        providerK,
        data,
      };
      await dtp.accessProofCondition.fulfillInstance(
        agreementData.instances[1] as ConditionInstance<AccessProofConditionExtra>,
        extra,
      );
    });

    it('buyer should have the key', async () => {
      const key = await dtp.readKey(agreementId, buyerK, providerPub);
      assert.equal(key.toString(), data.toString());
    });
  });
});
