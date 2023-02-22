import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Provider } from "@ethersproject/providers";
import { BigNumber, Contract, ContractFactory, Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// @ts-ignore
import { generateUtil } from "eth-delegatable-utils";
import { getPrivateKeys } from "../utils/getPrivateKeys";
import { generateDelegation } from "./utils";

const { getSigners } = ethers;

describe("DelegatableWeth", () => {
  const CONTACT_NAME = "DelegatableWeth";
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;

  // Smart Contracts
  let BlockNumberEnforcer: Contract;
  let BlockNumberBeforeEnforcerFactory: ContractFactory;
  let delegatableWeth: Contract;
  let delegatableWethFactory: ContractFactory;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(
      signer0.provider as unknown as Provider
    );
    delegatableWethFactory = await ethers.getContractFactory("DelegatableWeth");
    BlockNumberBeforeEnforcerFactory = await ethers.getContractFactory(
      "BlockNumberBeforeEnforcer"
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
    delegatableWeth = await delegatableWethFactory
      .connect(wallet0)
      .deploy(CONTACT_NAME, "DWETH");
    BlockNumberEnforcer = await BlockNumberBeforeEnforcerFactory.connect(
      wallet0
    ).deploy();

    CONTRACT_INFO = {
      chainId: delegatableWeth.deployTransaction.chainId,
      verifyingContract: delegatableWeth.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it("should SUCCEED to deposit", async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await delegatableWeth.balanceOf(wallet0.address)).to.eq(0);
    expect(await ethers.provider.getBalance(delegatableWeth.address)).to.eq(0);
    let weiAmount = ethers.utils.parseEther("1.0");
    let options = { value: weiAmount };
    let depositTx = await delegatableWeth.connect(wallet0).deposit(options);
    await depositTx.wait();
    expect(await ethers.provider.getBalance(delegatableWeth.address)).to.eq(
      weiAmount
    );
  });

  it("should SUCCEED to withdraw", async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await delegatableWeth.balanceOf(wallet0.address)).to.eq(0);
    expect(await ethers.provider.getBalance(delegatableWeth.address)).to.eq(0);
    let weiAmount = ethers.utils.parseEther("1.0");
    let options = { value: weiAmount };
    let depositTx = await delegatableWeth.connect(wallet0).deposit(options);
    await depositTx.wait();
    expect(await ethers.provider.getBalance(delegatableWeth.address)).to.eq(
      weiAmount
    );

    let withdrawTx = await delegatableWeth.connect(wallet0).withdraw(weiAmount);
    await withdrawTx.wait();
    expect(await ethers.provider.getBalance(delegatableWeth.address)).to.eq(0);
  });

  it("should SUCCEED to INVOKE method BEFORE blockNumber reached", async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await delegatableWeth.balanceOf(wallet0.address)).to.eq(0);

    let weiAmount = ethers.utils.parseEther("1.0");
    let options = { value: weiAmount };
    let depositTx = await delegatableWeth.connect(wallet0).deposit(options);
    await depositTx.wait();
    expect(await ethers.provider.getBalance(delegatableWeth.address)).to.eq(
      weiAmount
    );

    const _delegation = generateDelegation(
      CONTACT_NAME,
      delegatableWeth,
      PK,
      wallet1.address,
      [
        {
          enforcer: BlockNumberEnforcer.address,
          terms: "0x0000000000000032",
        },
      ]
    );
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: "0x01",
        queue: "0x00",
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: delegatableWeth.address,
            gasLimit: "210000000000000000",
            data: (
              await delegatableWeth.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther("0.5")
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);
    await delegatableWeth.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await delegatableWeth.balanceOf(wallet0.address)).to.eq(
      ethers.utils.parseEther("0.5")
    );
  });
});
