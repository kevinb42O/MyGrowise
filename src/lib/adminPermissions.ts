export const APP_ROLES = [
  'super_admin',
  'support',
  'employee',
  'practitioner',
  'customer',
] as const;

export type UserRole = (typeof APP_ROLES)[number];
export type AdminRole = Exclude<UserRole, 'customer'>;

export const ADMIN_PERMISSIONS = [
  'dashboard.read',
  'analytics.read',
  'orders.read',
  'orders.verify',
  'orders.refund',
  'customers.read',
  'customers.export',
  'client_records.read',
  'client_records.write',
  'client_records.assign',
  'client_records.archive',
  'products.read',
  'products.write',
  'products.review',
  'products.publish',
  'bookings.read',
  'bookings.manage',
  'agenda.read',
  'agenda.write',
  'professionals.read',
  'professionals.write',
  'content.read',
  'content.write',
  'content.publish',
  'internal_messages.read',
  'internal_messages.write',
  'support.read',
  'support.write',
  'privacy.read',
  'privacy.manage',
  'operations.manage',
  'integrations.read',
  'integrations.manage',
  'users.read',
  'users.manage',
  'audit.read',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const all = new Set<AdminPermission>(ADMIN_PERMISSIONS);
const permissions = (values: AdminPermission[]) => new Set<AdminPermission>(values);

/**
 * This is the authoritative application-level matrix. Supabase RLS still protects
 * browser reads; trusted Astro routes must consult this matrix before every
 * privileged operation because they use the service key.
 */
const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  super_admin: all,
  support: permissions(['dashboard.read', 'orders.read', 'customers.read', 'bookings.read', 'bookings.manage', 'support.read', 'support.write', 'privacy.read', 'privacy.manage', 'internal_messages.read', 'internal_messages.write']),
  employee: permissions(['client_records.read', 'client_records.write', 'internal_messages.read', 'internal_messages.write']),
  practitioner: permissions(['client_records.read', 'client_records.write', 'internal_messages.read', 'internal_messages.write']),
};

export const isUserRole = (value: string): value is UserRole => (APP_ROLES as readonly string[]).includes(value);
export const isAdminRole = (role: UserRole): role is AdminRole => role in ROLE_PERMISSIONS;
export const hasAdminPermission = (roles: readonly UserRole[], permission: AdminPermission) =>
  roles.some((role) => isAdminRole(role) && ROLE_PERMISSIONS[role].has(permission));
export const hasInternalMessagingAccess = (roles: readonly UserRole[]) => roles.includes('employee') || roles.includes('practitioner') || hasAdminPermission(roles, 'internal_messages.read');

export const firstAccessibleAdminPath = (roles: readonly UserRole[]) => {
  if (hasAdminPermission(roles, 'dashboard.read')) return '/admin';
  if (hasAdminPermission(roles, 'analytics.read')) return '/admin/analytics';
  if (hasAdminPermission(roles, 'products.read')) return '/admin/producten';
  if (hasAdminPermission(roles, 'orders.read')) return '/admin/bestellingen';
  if (hasAdminPermission(roles, 'client_records.read')) return '/admin/clienten';
  return null;
};

/** Null is deliberate: unregistered admin routes are denied by default. */
export const requiredAdminPermission = (path: string, method = 'GET'): AdminPermission | null => {
  if (path === '/admin') return 'dashboard.read';
  if (path === '/admin/analytics') return 'analytics.read';
  if (path === '/admin/bestellingen' || path === '/admin/betalingen') return 'orders.read';
  if (path === '/admin/klanten' || path.startsWith('/admin/klanten/')) return 'customers.read';
  if (path === '/admin/clienten' || path.startsWith('/admin/clienten/')) return 'client_records.read';
  if (path === '/admin/boekingen') return 'bookings.read';
  if (path === '/admin/agenda') return 'agenda.read';
  if (path.startsWith('/admin/professionals')) return 'professionals.read';
  if (path.startsWith('/admin/producten')) return 'products.read';
  if (path === '/admin/profielen' || path === '/admin/modules' || path === '/admin/content' || path.startsWith('/admin/content/')) return 'content.read';
  if (path === '/admin/berichten' || path.startsWith('/admin/berichten/')) return 'internal_messages.read';
  if (path === '/admin/instellingen') return 'integrations.read';
  if (path === '/admin/gebruikers') return 'users.read';
  if (path === '/admin/privacy') return 'privacy.read';

  if (path === '/api/admin/agenda') return method === 'GET' ? 'agenda.read' : 'agenda.write';
  if (path.startsWith('/api/admin/products')) return method === 'GET' ? 'products.read' : 'products.write';
  if (path.startsWith('/api/admin/wise-reconciliation')) return method === 'GET' ? 'orders.read' : 'orders.verify';
  if (path.startsWith('/api/admin/content')) return method === 'GET' ? 'content.read' : 'content.write';
  if (path.startsWith('/api/admin/support')) return method === 'GET' ? 'support.read' : 'support.write';
  if (path.startsWith('/api/admin/privacy')) return method === 'GET' ? 'privacy.read' : 'privacy.manage';
  if (path.startsWith('/api/admin/bookings')) return method === 'GET' ? 'bookings.read' : 'bookings.manage';
  if (path === '/api/admin/clienten/zoeken') return 'client_records.read';
  if (path.startsWith('/api/admin/clienten/') && path.endsWith('/toewijzingen')) return 'client_records.assign';
  if (path.startsWith('/api/admin/clienten/') && path.endsWith('/archiveren')) return 'client_records.archive';
  if (path.startsWith('/api/admin/clienten') || path.startsWith('/api/admin/notities')) return method === 'GET' ? 'client_records.read' : 'client_records.write';
  if (path.startsWith('/api/internal/messages')) return 'internal_messages.read';
  if (path === '/api/admin/users') return 'users.manage';
  if (path.startsWith('/api/admin/work-items')) return 'operations.manage';
  return null;
};
