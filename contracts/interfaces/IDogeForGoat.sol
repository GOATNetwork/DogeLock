// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { SendParam, OFTReceipt, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

interface IDogeForGoat {
    // events
    event Deposit(address indexed user, uint256 indexed amount, address indexed to);
    event Withdraw(address indexed user, uint256 indexed amount, address indexed to);
    event DepositAndBridge(address indexed user, uint256 indexed amount);

    /**
     * @dev Helper function to convert address to Bytes32 for peer setup.
     * @param _addr The address needed to be converted.
     * @return The converted address.
     */
    function addressToBytes32(address _addr) external pure returns (bytes32);

    /**
     * @dev Allow a user to deposit underlying tokens and mint the corresponding number of wrapped tokens.
     */
    function depositFor(address _account, uint256 _value) external;

    /**
     * @dev Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of underlying tokens.
     */
    function withdrawTo(address _account, uint256 _value) external;

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
    )
        external
        payable
        returns (MessagingReceipt memory _msgReceipt, OFTReceipt memory _oftReceipt, uint256 _dogeAmount);
}
