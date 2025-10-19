/**
 * Avatar utility functions for placeholder generation
 */

/**
 * Get initials from a name (first letter)
 * @param name - The user's name
 * @returns The first letter of the name, uppercased
 */
export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') {
    return '?';
  }
  
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return '?';
  }
  
  return trimmed[0].toUpperCase();
}

/**
 * Generate a consistent color from a string using a simple hash
 * @param str - The input string (e.g., user's name)
 * @returns A hex color string
 */
export function getColorFromString(str: string): string {
  if (!str || typeof str !== 'string') {
    return '#6B7280'; // Default gray color
  }
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Generate pleasant colors with good contrast
  // Using a limited palette of nice colors
  const colors = [
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Green
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#14B8A6', // Teal
  ];
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

