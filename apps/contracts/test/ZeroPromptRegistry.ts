import { expect } from "chai";
import { ethers } from "hardhat";

describe("ZeroPromptRegistry", () => {
  const promptId = ethers.keccak256(ethers.toUtf8Bytes("hello-world"));
  const uri = "ipfs://prompt-1";
  const newUri = "ipfs://prompt-1-updated";

  async function deployWithToken() {
    const [owner] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const usdt = await Mock.deploy("Tether", "USDT");
    await usdt.waitForDeployment();

    const Registry = await ethers.getContractFactory("ZeroPromptRegistry");
    const registry = await Registry.deploy([await usdt.getAddress()]);
    await registry.waitForDeployment();

    return { owner, usdt, registry };
  }

  it("registers and fetches a prompt", async () => {
    const { owner, usdt, registry } = await deployWithToken();

    await expect(registry.registerPrompt(promptId, uri, await usdt.getAddress()))
      .to.emit(registry, "PromptRegistered")
      .withArgs(promptId, owner.address, await usdt.getAddress(), uri);

    const stored = await registry.getPrompt(promptId);
    expect(stored.owner).to.equal(owner.address);
    expect(stored.uri).to.equal(uri);
    expect(stored.createdAt).to.be.gt(0);
    expect(stored.paymentToken).to.equal(await usdt.getAddress());
  });

  it("prevents duplicate prompt ids", async () => {
    const { registry, usdt } = await deployWithToken();

    await registry.registerPrompt(promptId, uri, await usdt.getAddress());
    await expect(
      registry.registerPrompt(promptId, uri, await usdt.getAddress())
    ).to.be.revertedWithCustomError(registry, "PromptExists");
  });

  it("rejects non-allowed tokens", async () => {
    const { registry } = await deployWithToken();
    const Mock = await ethers.getContractFactory("MockERC20");
    const other = await Mock.deploy("Other", "OTH");
    await other.waitForDeployment();

    await expect(
      registry.registerPrompt(promptId, uri, await other.getAddress())
    ).to.be.revertedWithCustomError(registry, "TokenNotAllowed");
  });

  it("allows owner to add a new token", async () => {
    const { registry } = await deployWithToken();
    const Mock = await ethers.getContractFactory("MockERC20");
    const dai = await Mock.deploy("Dai", "DAI");
    await dai.waitForDeployment();

    await expect(registry.setAllowedToken(await dai.getAddress(), true))
      .to.emit(registry, "AllowedTokenUpdated")
      .withArgs(await dai.getAddress(), true);

    await expect(registry.registerPrompt(promptId, uri, await dai.getAddress())).to.emit(
      registry,
      "PromptRegistered"
    );
  });

  it("blocks non-owners from setting allowed tokens", async () => {
    const { registry } = await deployWithToken();
    const [, attacker] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("Other", "OTH");
    await token.waitForDeployment();

    await expect(
      registry.connect(attacker).setAllowedToken(await token.getAddress(), true)
    ).to.be.revertedWithCustomError(registry, "NotOwner");
  });

  it("allows owner to update uri", async () => {
    const { owner, registry, usdt } = await deployWithToken();
    const [, other] = await ethers.getSigners();
    await registry.registerPrompt(promptId, uri, await usdt.getAddress());

    await expect(registry.connect(other).updatePrompt(promptId, newUri)).to.be.revertedWithCustomError(
      registry,
      "NotOwner"
    );

    await expect(registry.updatePrompt(promptId, newUri))
      .to.emit(registry, "PromptUpdated")
      .withArgs(promptId, owner.address, newUri);

    const stored = await registry.getPrompt(promptId);
    expect(stored.uri).to.equal(newUri);
  });
});
