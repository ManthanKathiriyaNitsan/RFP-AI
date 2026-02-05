/**
 * Central API path constants – all requests go to the RFP backend (VITE_API_BASE_URL).
 */
const V1 = "/api/v1";

export const API_PATHS = {
  auth: {
    login: `${V1}/auth/login`,
    register: `${V1}/auth/register`,
    refresh: `${V1}/auth/refresh`,
    logout: `${V1}/auth/logout`,
    forgotPassword: `${V1}/auth/forgot-password`,
    resetPassword: `${V1}/auth/reset-password`,
  },
  me: `${V1}/me`,
  users: {
    list: `${V1}/users`,
    search: `${V1}/users/search`,
    byId: (id: number) => `${V1}/users/${id}`,
    meAvatar: `${V1}/users/me/avatar`,
    meDelete: `${V1}/users/me`,
    resetPassword: (id: number) => `${V1}/users/${id}/reset-password`,
  },
  proposals: `${V1}/proposals`,
  proposal: (id: number) => `${V1}/proposals/${id}`,
  integrations: `${V1}/integrations`,
  integration: (id: number) => `${V1}/integrations/${id}`,
} as const;
