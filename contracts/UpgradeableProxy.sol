// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract UpgradeableProxy is TransparentUpgradeableProxy {
    constructor(address _logic, address _initialOwner) TransparentUpgradeableProxy(_logic, _initialOwner, "") {}

    function proxyAdmin() external view returns (address) {
        return _proxyAdmin();
    }
}
