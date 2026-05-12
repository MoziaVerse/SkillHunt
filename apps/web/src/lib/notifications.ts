const unreadCountEventName = 'skillhunt:notifications-unread-count-change';

export function publishUnreadNotificationCount(count: number) {
  window.dispatchEvent(
    new CustomEvent(unreadCountEventName, {
      detail: { count: Math.max(0, count) },
    }),
  );
}

export function subscribeUnreadNotificationCount(onChange: (count: number) => void) {
  const handleUnreadCountChange = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const count = event.detail?.count;
    if (typeof count === 'number') onChange(Math.max(0, count));
  };

  window.addEventListener(unreadCountEventName, handleUnreadCountChange);
  return () => window.removeEventListener(unreadCountEventName, handleUnreadCountChange);
}
