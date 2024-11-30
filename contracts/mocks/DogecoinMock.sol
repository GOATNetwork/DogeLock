// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// @dev WARNING: This is for testing purposes only
contract DogecoinMock is ERC20 {
    constructor() ERC20("Dogecoin Mock", "DM") {}

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }

    function decimals() public pure override returns (uint8) {
        return 8;
    }
}
