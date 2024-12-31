// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OFTAdapterUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTAdapterUpgradeable.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @dev Layer Zero adapter for Dogecoin.
 */
contract DogeAdapterUpgradeable is OFTAdapterUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public immutable dogeCoin;

    /**
     * @dev Constructor for the DogeLockUpgradeable contract.
     * @param _dogeCoin The address of the Dogecoin token.
     * @param _lzEndpoint The LayerZero endpoint address.
     */
    constructor(address _dogeCoin, address _lzEndpoint) OFTAdapterUpgradeable(_dogeCoin, _lzEndpoint) {
        dogeCoin = IERC20(_dogeCoin);
    }

    /**
     * @dev Initializes the DogeLockUpgradeable with the provided owner and locking limits.
     * @param _owner The owner/delegate of the contract/OFTAdapter.
     */
    function initialize(address _owner) external initializer {
        __OFTAdapter_init(_owner);
        __Ownable_init(_owner);
    }

    /**
     * @dev Helper function to convert address to Bytes32 for peer setup.
     * @param _addr The address needed to be converted.
     * @return The converted address.
     */
    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /**
     * @dev Allows the owner to retrieve tokens from the contract.
     *      If the token address is zero, it transfers the specified amount of native token to the given address.
     *      Otherwise, it transfers the specified amount of the given ERC20 token to the given address.
     *      The function ensures that DogeCoin tokens cannot be retrieved.
     * @param _token The address of the token to retrieve. Use address(0) for native token.
     * @param _to The address to which the tokens or native token will be sent.
     * @param _amount The amount of tokens or native token to retrieve.
     */
    function retrieveTokens(address _token, address _to, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            payable(_to).transfer(_amount);
        } else {
            require(_token != address(dogeCoin), "Token is DogeCoin");
            IERC20(_token).safeTransfer(_to, _amount);
        }
    }
}
