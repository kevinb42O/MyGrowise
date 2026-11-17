/** Always select the matching inbox tab, including dual-role practice accounts. */
export const notificationHref = (item: { threadId: string | null; supportConversationId: string | null }, basePath: string) => {
  if (item.supportConversationId) return `${basePath}?view=support&conversation=${encodeURIComponent(item.supportConversationId)}`;
  if (item.threadId) return `${basePath}?view=team&thread=${encodeURIComponent(item.threadId)}`;
  return basePath;
};
