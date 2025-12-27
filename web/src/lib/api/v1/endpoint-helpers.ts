/**
 * Handles authentication API responses with consistent error checking
 * Validates the response structure and extracts the data payload
 */
export function handleAuthResponse<T>(
  response: { data?: { success: boolean; data?: T; error?: string } }
): T {
  if (!response.data) {
    throw new Error('No response data received from server');
  }
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Authentication failed');
  }
  
  if (!response.data.data) {
    throw new Error('No data received from server');
  }
  
  return response.data.data;
}
