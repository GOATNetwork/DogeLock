// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { SendParam, OFTReceipt, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

interface IDogeLock {
    event Lock(address user, uint256 amount, uint256 blockNumber);
    event Unlock(address user, uint256 amount, uint256 blockNumber);

    error InvalidAmount();
    error ExceededAmount();
    error ExceededMax();
    error BelowMin();

    function addressToBytes32(address _addr) external pure returns (bytes32);

    function setMax(uint256 _amount) external;

    function setPersonalLimit(uint256 _max, uint256 _min) external;

    function lock(uint256 _amount) external;

    function unlock(uint256 _amount) external;

    function bridge(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt);
}
