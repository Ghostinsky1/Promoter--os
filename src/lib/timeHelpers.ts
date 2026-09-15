export function convertTo12Hour(time24: string): string {
  const [hours24, minutes] = time24.split(':').map(Number);
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function convertTo24Hour(time12: string): string {
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12;

  let [, hours, minutes, period] = match;
  let hours24 = parseInt(hours);

  if (period.toUpperCase() === 'PM' && hours24 !== 12) {
    hours24 += 12;
  } else if (period.toUpperCase() === 'AM' && hours24 === 12) {
    hours24 = 0;
  }

  return `${String(hours24).padStart(2, '0')}:${minutes}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}
