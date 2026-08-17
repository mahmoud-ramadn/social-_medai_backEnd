export const getRoomId = (userId1: string, userId2: string): string => {
  // Sort the IDs so both users end up in the same room
  const sorted = [userId1, userId2].sort();
  return `chat_${sorted[0]}_${sorted[1]}`;
};
