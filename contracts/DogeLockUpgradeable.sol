// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IOFT, SendParam, MessagingFee, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { IDogeLock } from "./interfaces/IDogeLock.sol";

/**
 * @dev Locking and bridging contract for Dogecoin.
 */
contract DogeLockUpgradeable is IDogeLock, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public immutable dogeCoin;
    address public immutable dogeAdapter;

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
    constructor(address _dogeCoin, address _dogeAdapter) {
        dogeCoin = IERC20(_dogeCoin);
        require(_dogeAdapter != address(0), InvalidAddress());
        dogeAdapter = _dogeAdapter;
    }

    /**
     * @dev Initializes the DogeLockUpgradeable with the provided owner and locking limits.
     * @param _owner The owner/delegate of the contract/OFTAdapter.
     */
    function initialize(address _owner) external initializer {
        __Ownable_init(_owner);
        maxLockAmount = 5_000_000 * DOGE_DECIMAL;
        personalMaxLockAmount = 50_000 * DOGE_DECIMAL;
        personalMinLockAmount = 50 * DOGE_DECIMAL;
    }

    /**
     * @dev Owner function to set the max total locking amount of Dogecoin.
     * @param _amount The new max total locking amount.
     */
    function setMax(uint256 _amount) external onlyOwner {
        require(_amount >= totalBalance, InvalidAmount());
        maxLockAmount = _amount;
        emit MaxSet(_amount);
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
        emit PersonalLimitSet(_max, _min);
    }

    /**
     * @dev Lock user's Dogecoin into this contract.
     * @param _amount The amount the user wishes to lock.
     * @dev The amount and lock time is recorded for points calculation on Goat Network.
     * @dev The user must approve the amount before calling this function.
     * @dev The amount cannot be less than the personal min.
     * @dev The final user/total balance cannot exceed the personal/total max.
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
        balances[msg.sender] -= _amount;
        totalBalance -= _amount;
        dogeCoin.safeTransfer(msg.sender, _amount);
        emit Unlock(msg.sender, _amount, block.number);
    }

    /**
     * @dev Approve the maximum amount of Dogecoin to the Adapter.
     */
    function approveMax() external {
        dogeCoin.approve(dogeAdapter, type(uint256).max);
    }

    /**
     * @dev Bridge locked Dogecoin through Adapter.
     * @param _sendParam The parameters for the send operation.
     * @param _fee The calculated fee for the send() operation.
     */
    function bridge(SendParam calldata _sendParam, MessagingFee calldata _fee) external payable {
        require(_fee.lzTokenFee == 0, PaymentNotSupported());
        uint256 amount = _sendParam.amountLD;
        require(amount <= balances[msg.sender], ExceededBalance(balances[msg.sender]));
        (, OFTReceipt memory receipt) = IOFT(dogeAdapter).send{ value: msg.value }(_sendParam, _fee, msg.sender);
        amount = receipt.amountSentLD;
        balances[msg.sender] -= amount;
        totalBalance -= amount;
        emit Unlock(msg.sender, amount, block.number);
        emit Bridge(msg.sender, amount, _sendParam);
    }
}
