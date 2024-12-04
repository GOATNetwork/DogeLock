// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";

/**
 * @title GoatOFT Contract
 * @dev GoatOFT is a general OFT contract to be deployed on Goat chain to receive
 * bridged token from other chains
 */
contract GoatOFT is OFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
