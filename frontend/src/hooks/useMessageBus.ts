import { useRef } from 'react'
import { MessageBus } from '../communication/message-bus'

let messageBusInstance: MessageBus | null = null

export function getMessageBus(): MessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus()
  }
  return messageBusInstance
}

export function useMessageBus(): MessageBus {
  const busRef = useRef<MessageBus>(getMessageBus())
  return busRef.current
}
