// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { SendParam, OFTReceipt, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

interface IDogeForGoat {
    function depositAndSend(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _account
    ) external payable returns (uint256 _dogeAmount);
}
