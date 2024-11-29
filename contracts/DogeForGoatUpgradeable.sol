// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OFTUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTUpgradeable.sol";
import { SendParam, OFTReceipt, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDogeLock } from "./interfaces/IDogeLock.sol";

/**
 * @dev Locking and bridging contract for Dogecoin.
 */
contract DogeForGoatUpgradeable is OFTUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public immutable dogeCoin;

    // Conversion rate from Dogecoin (8 decimals) to Wrapped Dogecoin (18 decimals)
    uint256 private constant CONVERSION_MULTIPLIER = 10 ** 10;

    /**
     * @dev Constructor for the DogeLockUpgradeable contract.
     * @param _dogeCoin The address of the Dogecoin token.
     * @param _lzEndpoint The LayerZero endpoint address.
     */
    constructor(address _dogeCoin, address _lzEndpoint) OFTUpgradeable(_lzEndpoint) {
        dogeCoin = IERC20(_dogeCoin);
    }

    /**
     * @dev Initializes the DogeLockUpgradeable with the provided owner and locking limits.
     * @param _owner The owner/delegate of the contract/OFTAdapter
     */
    function initialize(address _owner) external initializer {
        __OFT_init("Doge For Goat", "DFG", _owner);
        __Ownable_init(_owner);
    }

    /**
     * @dev Helper function to convert address to Bytes32 for peer setup
     * @param _addr The address needed to be converted
     * @return The converted address
     */
    function addressToBytes32(address _addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /**
     * @dev Allow a user to deposit underlying tokens and mint the corresponding number of wrapped tokens.
     */
    function deposit(uint256 _value) public {
        dogeCoin.safeTransferFrom(msg.sender, address(this), _value);
        _mint(msg.sender, _value * CONVERSION_MULTIPLIER);
    }

    /**
     * @dev Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of underlying tokens.
     */
    function withdraw(uint256 _value) public {
        _burn(msg.sender, _value);
        dogeCoin.safeTransfer(msg.sender, _value / CONVERSION_MULTIPLIER);
    }

    /**
     * @dev Mint wrapped token to cover any dogecoin that would have been transferred by mistake or acquired from
     * rebasing mechanisms.
     */
    function recover(address _account) public onlyOwner returns (uint256) {
        uint256 value = dogeCoin.balanceOf(address(this)) * CONVERSION_MULTIPLIER - totalSupply();
        _mint(_account, value);
        return value;
    }
}
