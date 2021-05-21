const MyRaribleToken = artifacts.require("MyRaribleToken");

module.exports = function (deployer) {
  deployer.deploy(MyRaribleToken);
};
