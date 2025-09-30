import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68b1d6f396de1d50f2b1a3b9", 
  requiresAuth: true // Ensure authentication is required for all operations
});
