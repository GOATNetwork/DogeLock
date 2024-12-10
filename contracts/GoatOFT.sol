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
        address _lzEndpoint,
        address _delegate
    ) OFT("GOAT BSC DOGE", "DOGEB", _lzEndpoint, _delegate) Ownable(_delegate) {}
}
