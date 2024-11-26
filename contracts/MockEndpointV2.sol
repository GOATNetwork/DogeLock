// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockEndpointV2 {
    // this is a simple mock contract
    // if you need to simulate specific EndpointV2 functions, you can add the corresponding methods

    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    // if you need to simulate more EndpointV2 functions, you can add them here
}
