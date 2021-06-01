import React, { useCallback, useRef, useState, useMemo, useEffect, SyntheticEvent, DOMAttributes, MutableRefObject } from 'react';
import { findDOMNode, createPortal } from 'react-dom';

type HTMLElRef = MutableRefObject<HTMLElement>

type CustomEvent = {
  event?: SyntheticEvent<any, Event>
  portal: HTMLElRef
  targetEl: HTMLElRef
} & SyntheticEvent<any, Event>

type CustomEventHandler = (customEvent: CustomEvent) => void
type CustomEventHandlers = {
  [K in keyof DOMAttributes<K>]?: CustomEventHandler
}

type EventListenerMap = { [K in keyof DOMAttributes<K>]: keyof GlobalEventHandlersEventMap }
type EventListenersRef = MutableRefObject<{
  [K in keyof DOMAttributes<K>]?: (event: SyntheticEvent<any, Event>) => void
}>

export type UsePortalOptions = {
  bindTo?: HTMLElement,
  isVisible?: boolean,
  closeOnOutsideClick?: boolean,
  closeOnEsc?: boolean,
  onClose?: CustomEventHandler,
  onOpen?: CustomEventHandler,
  onPortalClick?: CustomEventHandler,
} & CustomEventHandlers

const usePortal = ({
  closeOnEsc = true, // 允许esc退出
  closeOnOutsideClick = true,
  bindTo,
  isVisible: defaultVisibe = false,
  onClose,
  onOpen,
  onPortalClick,
  ...eventHandlers
}: UsePortalOptions = {}) => {
  const [isVisible, makeVisible] = useState<boolean>(defaultVisibe);

  const visibleRef = useRef(isVisible);

  const setVisible = useCallback((v: boolean) => {
    visibleRef.current = v;
    makeVisible(v);
  }, []);

  const targetEl = useRef() as HTMLElRef;

  const portal = useRef(document.createElement('div')) as HTMLElRef

  useEffect(() => {
    if (!portal.current) {
      portal.current = document.createElement('div')
    }
  }, [portal])

  const elToMountTo = useMemo(() => {
    return (bindTo && findDOMNode(bindTo)) || document.body
  }, [bindTo]);

  const Portal = useCallback(({ children }: { children: React.ReactNode }) => {
    if (portal.current != null) {
      return createPortal(children, portal.current)
    }
    return null
  }, [portal])

  const eventListeners = useRef({}) as EventListenersRef

  const createCustomEvent = (e: any) => {
    if (!e) return { portal, targetEl, event: e }
    const event = e || {}
    if (event.persist) event.persist()
    event.portal = portal
    event.targetEl = targetEl
    event.event = e
    const { currentTarget } = e
    if (!targetEl.current && currentTarget && currentTarget !== document) targetEl.current = event.currentTarget
    return event
  }

  const openPortal = useCallback((e: any) => {
    const customEvent = createCustomEvent(e)
    if (targetEl.current == null) {
      setTimeout(() => setVisible(true), 0)
      throw Error('error')
    }
    if (onOpen) onOpen(customEvent)
    setVisible(true)
  }, [portal, setVisible, targetEl, onOpen])

  const closePortal = useCallback((e: any) => {
    const customEvent = createCustomEvent(e)
    if (onClose && visibleRef.current) onClose(customEvent)
    if (visibleRef.current) setVisible(false)
  }, [onClose, setVisible])

  const handleKeydown = useCallback((e: KeyboardEvent): void => 
    (e.key === 'Escape' && closeOnEsc) ? closePortal(e) : undefined,
    [closeOnEsc, closePortal]
  )

  const handleOutsideMouseClick = useCallback((e: MouseEvent): void => {
    const containsTarget = (target: HTMLElRef) => target.current.contains(e.target as HTMLElement)
    if (containsTarget(portal) || (e as any).button !== 0 || !visibleRef.current || containsTarget(targetEl)) return
    if (closeOnOutsideClick) closePortal(e)
  }, [closePortal, closeOnOutsideClick, portal])

  const handleMouseDown = useCallback((e: MouseEvent): void => {
    if (!(portal.current instanceof HTMLElement)) return
    const customEvent = createCustomEvent(e)
    if (portal.current.contains(customEvent.target as HTMLElement) && onPortalClick) onPortalClick(customEvent)
    handleOutsideMouseClick(e)
  }, [handleOutsideMouseClick])

  useEffect(() => {
    if (!(elToMountTo instanceof HTMLElement) || !(portal.current instanceof HTMLElement)) return

    // TODO: eventually will need to figure out a better solution for this.
    // Surely we can find a way to map onScroll/onWheel -> scroll/wheel better,
    // but for all other event handlers. For now this works.
    const eventHandlerMap: EventListenerMap = {
      onScroll: 'scroll',
      onWheel: 'wheel',
    }
    const node = portal.current
    elToMountTo.appendChild(portal.current)
    // handles all special case handlers. Currently only onScroll and onWheel
    Object.entries(eventHandlerMap).forEach(([handlerName /* onScroll */, eventListenerName /* scroll */]) => {
      if (!eventHandlers[handlerName as keyof EventListenerMap]) return
      eventListeners.current[handlerName as keyof EventListenerMap] = (e: any) => (eventHandlers[handlerName as keyof EventListenerMap] as any)(createCustomEvent(e))
      document.addEventListener(eventListenerName as keyof GlobalEventHandlersEventMap, eventListeners.current[handlerName as keyof EventListenerMap] as any)
    })
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('mousedown', handleMouseDown as any)

    return () => {
      // handles all special case handlers. Currently only onScroll and onWheel
      Object.entries(eventHandlerMap).forEach(([handlerName, eventListenerName]) => {
        if (!eventHandlers[handlerName as keyof EventListenerMap]) return
        document.removeEventListener(eventListenerName as keyof GlobalEventHandlersEventMap, eventListeners.current[handlerName as keyof EventListenerMap] as any)
        delete eventListeners.current[handlerName as keyof EventListenerMap]
      })
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('mousedown', handleMouseDown as any)
      elToMountTo.removeChild(node)
    }
  }, [handleOutsideMouseClick, handleKeydown, elToMountTo, portal])


  return {
    isVisible: visibleRef.current,
    portalRef: portal,
    ref: targetEl,
    Portal,
    openPortal,
    closePortal
  }
}

export default usePortal;