// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OFTUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTUpgradeable.sol";
import { SendParam, OFTReceipt, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDogeForGoat } from "./interfaces/IDogeForGoat.sol";
import { IDogeLock } from "./interfaces/IDogeLock.sol";

/**
 * @dev Locking and bridging contract for Dogecoin.
 */
contract DogeForGoatUpgradeable is IDogeForGoat, OFTUpgradeable {
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
     * @param _owner The owner/delegate of the contract/OFTAdapter.
     */
    function initialize(address _owner) external initializer {
        __OFT_init("Doge For Goat", "DFG", _owner);
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
     * @dev Allow a user to deposit underlying tokens and mint the corresponding number of wrapped tokens.
     */
    function depositFor(address _account, uint256 _value) public {
        require(_account != address(this), ERC20InvalidReceiver(_account));
        dogeCoin.safeTransferFrom(msg.sender, address(this), _value);
        _mint(_account, _value * CONVERSION_MULTIPLIER);
        emit Deposit(msg.sender, _value, _account);
    }

    /**
     * @dev Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of underlying tokens.
     */
    function withdrawTo(address _account, uint256 _value) public {
        require(_account != address(this), ERC20InvalidReceiver(_account));
        _burn(msg.sender, _value);
        dogeCoin.safeTransfer(_account, _value / CONVERSION_MULTIPLIER);
        emit Withdraw(msg.sender, _value, _account);
    }

    /**
     * @dev Combination of the depositFor() and send() functions.
     * @param _sendParam The parameters for the send operation.
     * @param _fee The calculated fee for the send() operation.
     *      - nativeFee: The native fee.
     *      - lzTokenFee: The lzToken fee.
     * @param _refundAddress The address to receive any excess funds.
     * @return _msgReceipt The receipt for the send operation.
     * @return _oftReceipt The OFT receipt information.
     * @return _dogeAmount The amount of dogecoin is deposited.
     *
     * @dev Note: approve is required
     */
    function depositAndSend(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) public payable returns (MessagingReceipt memory _msgReceipt, OFTReceipt memory _oftReceipt, uint256 _dogeAmount) {
        // @dev get the amount after removeDust().
        // - amountSentLD is the amount in local decimals that was ACTUALLY sent/debited from the sender.
        // - amountReceivedLD is the amount in local decimals that will be received/credited to the recipient on the remote OFT instance.
        (uint256 amountSentLD, uint256 amountReceivedLD) = _debitView(
            _sendParam.amountLD,
            _sendParam.minAmountLD,
            _sendParam.dstEid
        );
        _dogeAmount = amountSentLD / CONVERSION_MULTIPLIER;
        dogeCoin.safeTransferFrom(msg.sender, address(this), _dogeAmount);

        // @dev Builds the options and OFT message to quote in the endpoint.
        (bytes memory message, bytes memory options) = _buildMsgAndOptions(_sendParam, amountReceivedLD);

        // @dev Sends the message to the LayerZero endpoint and returns the LayerZero msg receipt.
        _msgReceipt = _lzSend(_sendParam.dstEid, message, options, _fee, _refundAddress);
        // @dev Formulate the OFT receipt.
        _oftReceipt = OFTReceipt(amountSentLD, amountReceivedLD);

        emit OFTSent(_msgReceipt.guid, _sendParam.dstEid, msg.sender, amountSentLD, amountReceivedLD);
        emit DepositAndBridge(msg.sender, _dogeAmount);
    }
}
