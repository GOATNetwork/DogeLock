// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SendParam, MessagingFee, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { IDogeLock } from "./interfaces/IDogeLock.sol";
import { IDogeForGoat } from "./interfaces/IDogeForGoat.sol";

/**
 * @dev Locking and bridging contract for Dogecoin.
 */
contract DogeLockUpgradeable is IDogeLock, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public immutable dogeCoin;
    address public immutable oft;

    uint256 constant DOGE_DECIMAL = 100_000_000;

    uint256 public maxLockAmount;
    uint256 public personalMaxLockAmount;
    uint256 public personalMinLockAmount;

    mapping(address user => uint256 balance) public balances;
    uint256 public totalBalance;

    /**
     * @dev Constructor for the DogeLockUpgradeable contract.
     * @param _dogeCoin The address of the Dogecoin token.
     */
    constructor(address _dogeCoin, address _oft) {
        dogeCoin = IERC20(_dogeCoin);
        oft = _oft;
    }

    /**
     * @dev Initializes the DogeLockUpgradeable with the provided owner and locking limits.
     * @param _owner The owner/delegate of the contract/OFTAdapter.
     */
    function initialize(address _owner) external initializer {
        __Ownable_init(_owner);
        maxLockAmount = 20_000_000 * DOGE_DECIMAL;
        personalMaxLockAmount = 500_000 * DOGE_DECIMAL;
        personalMinLockAmount = 50 * DOGE_DECIMAL;
    }

    /**
     * @dev Owner function to set the max total locking amount of Dogecoin.
     * @param _amount The new max total locking amount.
     */
    function setMax(uint256 _amount) external onlyOwner {
        require(_amount >= totalBalance, InvalidAmount());
        maxLockAmount = _amount;
    }

    /**
     * @dev Owner function to set the max/min locking amount of Dogecoin for each user.
     * @param _max The new max locking amount.
     * @param _min The new min locking amount.
     */
    function setPersonalLimit(uint256 _max, uint256 _min) external onlyOwner {
        require(_max > _min, InvalidAmount());
        personalMaxLockAmount = _max;
        personalMinLockAmount = _min;
    }

    /**
     * @dev Lock user's Dogecoin into this contract.
     * @param _amount The amount the user wishes to lock.
     * @dev The amount and lock time is recorded for points calculation on Goat Network.
     * @dev The user must approve the amount before calling this function.
     * @dev The final amount cannot be less than the personal min or more than personal/total max.
     */
    function lock(uint256 _amount) external {
        require(_amount >= personalMinLockAmount, BelowMin());
        balances[msg.sender] += _amount;
        totalBalance += _amount;
        require(balances[msg.sender] <= personalMaxLockAmount, ExceededPersonalMax(balances[msg.sender]));
        require(totalBalance <= maxLockAmount, ExceededTotalMax(totalBalance));
        dogeCoin.safeTransferFrom(msg.sender, address(this), _amount);
        emit Lock(msg.sender, _amount, block.number);
    }

    /**
     * @dev Unlock user's Dogecoin from this contract.
     * @param _amount The amount the user wishes to unlock.
     * @dev The amount and unlock time is recorded for points calculation on Goat Network.
     */
    function unlock(uint256 _amount) external {
        require(_amount <= balances[msg.sender], ExceededBalance(balances[msg.sender]));
        require(_amount <= totalBalance, ExceededTotalBalance(totalBalance));
        balances[msg.sender] -= _amount;
        totalBalance -= _amount;
        dogeCoin.safeTransfer(msg.sender, _amount);
        emit Unlock(msg.sender, _amount, block.number);
    }

    /**
     * @dev Bridge locked dogecoin.
     * @param _amount The amount the user wishes to bridge.
     * @param _sendParam The parameters for the send operation.
     * @param _fee The calculated fee for the send() operation.
     */
    function bridge(uint256 _amount, SendParam calldata _sendParam, MessagingFee calldata _fee) external payable {
        require(_fee.lzTokenFee == 0, PaymentNotSupported());
        require(oft != address(0), InvalidAddress());
        dogeCoin.approve(oft, _amount);
        (, , _amount) = IDogeForGoat(oft).depositAndSend{ value: msg.value }(_sendParam, _fee, msg.sender);
        balances[msg.sender] -= _amount;
        totalBalance -= _amount;
        emit Unlock(msg.sender, _amount, block.number);
        emit Bridge(msg.sender, _amount, _sendParam);
    }
}
