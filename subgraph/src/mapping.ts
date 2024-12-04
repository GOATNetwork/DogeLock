import { BigInt } from '@graphprotocol/graph-ts'

import { Bridge, Lock, Unlock } from '../generated/DogeLock/DogeLock'
import { BridgeEvent, GlobalStat, LockEvent, UnlockEvent, User } from '../generated/schema'

function getOrCreateUser(address: string): User {
    let user = User.load(address)
    if (!user) {
        user = new User(address)
        user.totalLocked = BigInt.fromI32(0)
        user.save()

        // Update global stats
        const global = getOrCreateGlobalStat()
        global.userCount = global.userCount.plus(BigInt.fromI32(1))
        global.save()
    }
    return user
}

function getOrCreateGlobalStat(): GlobalStat {
    let global = GlobalStat.load('global')
    if (!global) {
        global = new GlobalStat('global')
        global.totalLocked = BigInt.fromI32(0)
        global.userCount = BigInt.fromI32(0)
        global.save()
    }
    return global
}

export function handleLock(event: Lock): void {
    const user = getOrCreateUser(event.params.user.toHexString())

    // Create lock event
    const lockEvent = new LockEvent(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
    lockEvent.user = user.id
    lockEvent.amount = event.params.amount
    lockEvent.blockNumber = event.params.blockNumber
    lockEvent.timestamp = event.block.timestamp
    lockEvent.transactionHash = event.transaction.hash.toHexString()
    lockEvent.save()

    // Update user stats
    user.totalLocked = user.totalLocked.plus(event.params.amount)
    user.save()

    // Update global stats
    const global = getOrCreateGlobalStat()
    global.totalLocked = global.totalLocked.plus(event.params.amount)
    global.save()
}

export function handleUnlock(event: Unlock): void {
    const user = getOrCreateUser(event.params.user.toHexString())

    // Create unlock event
    const unlockEvent = new UnlockEvent(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
    unlockEvent.user = user.id
    unlockEvent.amount = event.params.amount
    unlockEvent.blockNumber = event.params.blockNumber
    unlockEvent.timestamp = event.block.timestamp
    unlockEvent.transactionHash = event.transaction.hash.toHexString()
    unlockEvent.save()

    // Update user stats
    user.totalLocked = user.totalLocked.minus(event.params.amount)
    user.save()

    // Update global stats
    const global = getOrCreateGlobalStat()
    global.totalLocked = global.totalLocked.minus(event.params.amount)
    global.save()
}

export function handleBridge(event: Bridge): void {
    const user = getOrCreateUser(event.params.user.toHexString())

    // Create bridge event
    const bridgeEvent = new BridgeEvent(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
    bridgeEvent.user = user.id
    bridgeEvent.amount = event.params.amount
    bridgeEvent.dstChainId = event.params.sendParam.dstEid
    bridgeEvent.blockNumber = event.block.number
    bridgeEvent.timestamp = event.block.timestamp
    bridgeEvent.transactionHash = event.transaction.hash.toHexString()
    bridgeEvent.save()

    // Update user stats
    user.totalLocked = user.totalLocked.minus(event.params.amount)
    user.save()

    // Update global stats
    const global = getOrCreateGlobalStat()
    global.totalLocked = global.totalLocked.minus(event.params.amount)
    global.save()
}
