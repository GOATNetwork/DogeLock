// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OFTAdapterUpgradeable } from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTAdapterUpgradeable.sol";
import { SendParam, OFTReceipt, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IDogeLock } from "./interfaces/IDogeLock.sol";

contract DogeLockUpgradeable is IDogeLock, OFTAdapterUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public immutable dogeCoin;
    uint256 public immutable bridgeTime;

    uint256 constant DECIMAL = 100_000_000;

    uint256 public maxLockAmount;
    uint256 public personalMaxLockAmount;
    uint256 public personalMinLockAmount;

    mapping(address user => uint256 balance) public balances;
    uint256 public totalBalance;

    constructor(
        address _dogeCoin,
        address _lzEndpoint,
        uint256 _bridgeTime
    ) OFTAdapterUpgradeable(_dogeCoin, _lzEndpoint) {
        bridgeTime = _bridgeTime;
        dogeCoin = IERC20(_dogeCoin);
    }

    function initialize(address _owner) external initializer {
        __OFTAdapter_init(_owner);
        __Ownable_init(_owner);
        maxLockAmount = 20_000_000 * DECIMAL;
        personalMaxLockAmount = 5_000_000 * DECIMAL;
        personalMinLockAmount = 50 * DECIMAL;
    }

    function addressToBytes32(address _addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function setMax(uint256 _amount) external onlyOwner {
        maxLockAmount = _amount;
    }

    function setPersonalLimit(uint256 _max, uint256 _min) external onlyOwner {
        require(_max > _min, InvalidAmount());
        personalMaxLockAmount = _max;
        personalMinLockAmount = _min;
    }

    function lock(uint256 _amount) external {
        require(_amount >= personalMinLockAmount, BelowMin());
        dogeCoin.safeTransferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;
        totalBalance += _amount;
        require(balances[msg.sender] <= personalMaxLockAmount && totalBalance <= maxLockAmount, ExceededMax());
        emit Lock(msg.sender, _amount, block.number);
    }

    function unlock(uint256 _amount) external {
        require(_amount <= balances[msg.sender], ExceededAmount());
        balances[msg.sender] -= _amount;
        totalBalance -= _amount;
        dogeCoin.safeTransfer(msg.sender, _amount);
        emit Unlock(msg.sender, _amount, block.number);
    }

    function bridge(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        require(block.timestamp >= bridgeTime, TimeNotReached());
        // @dev Applies the token transfers regarding this bridge() operation.
        // - amountSentLD is the amount in local decimals that was ACTUALLY sent/debited from the sender.
        // - amountReceivedLD is the amount in local decimals that will be received/credited to the recipient on the remote OFT instance.
        (uint256 amountSentLD, uint256 amountReceivedLD) = _debit(
            msg.sender,
            _sendParam.amountLD,
            _sendParam.minAmountLD,
            _sendParam.dstEid
        );

        // @dev Builds the options and OFT message to quote in the endpoint.
        (bytes memory message, bytes memory options) = _buildMsgAndOptions(_sendParam, amountReceivedLD);

        // @dev Sends the message to the LayerZero endpoint and returns the LayerZero msg receipt.
        msgReceipt = _lzSend(_sendParam.dstEid, message, options, _fee, _refundAddress);
        // @dev Formulate the OFT receipt.
        oftReceipt = OFTReceipt(amountSentLD, amountReceivedLD);

        emit OFTSent(msgReceipt.guid, _sendParam.dstEid, msg.sender, amountSentLD, amountReceivedLD);
    }

    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        (amountSentLD, amountReceivedLD) = _debitView(_amountLD, _minAmountLD, _dstEid);
        balances[_from] -= amountSentLD;
    }
}
