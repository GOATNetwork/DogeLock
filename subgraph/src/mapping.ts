import { BigInt } from '@graphprotocol/graph-ts'

import { Lock, OFTReceived, OFTSent, Unlock } from '../generated/DogeLock/DogeLock'
import { GlobalStat, LockEvent, OFTReceivedEvent, OFTSentEvent, UnlockEvent, User } from '../generated/schema'

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

export function handleOFTSent(event: OFTSent): void {
    const user = getOrCreateUser(event.params.fromAddress.toHexString())

    const sentEvent = new OFTSentEvent(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
    sentEvent.user = user.id
    sentEvent.guid = event.params.guid
    sentEvent.dstChainId = event.params.dstEid
    sentEvent.amount = event.params.amountSentLD
    sentEvent.actualAmount = event.params.amountReceivedLD
    sentEvent.blockNumber = event.block.number
    sentEvent.timestamp = event.block.timestamp
    sentEvent.transactionHash = event.transaction.hash.toHexString()
    sentEvent.save()
}

export function handleOFTReceived(event: OFTReceived): void {
    const user = getOrCreateUser(event.params.toAddress.toHexString())

    const receivedEvent = new OFTReceivedEvent(event.transaction.hash.toHexString() + '-' + event.logIndex.toString())
    receivedEvent.user = user.id
    receivedEvent.guid = event.params.guid
    receivedEvent.srcChainId = event.params.srcEid
    receivedEvent.amount = event.params.amountReceivedLD
    receivedEvent.blockNumber = event.block.number
    receivedEvent.timestamp = event.block.timestamp
    receivedEvent.transactionHash = event.transaction.hash.toHexString()
    receivedEvent.save()
}
