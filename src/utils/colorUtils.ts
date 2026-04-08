export const isLightColor = (color: string): boolean => {
  const hex = color.replace('#', '');
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  }
  // Fallback for named colors or invalid hex
  return ['#FFD700', '#00FFFF', '#7FFFD4', '#F0F0F0', '#FFFFFF'].includes(color.toUpperCase());
};
