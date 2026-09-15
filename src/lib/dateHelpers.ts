export function toLocalDateString(date: string | Date | null | undefined): string {
  if (!date) return '';

  try {
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    const parts = dateStr.split('T')[0];
    if (!parts || parts.split('-').length !== 3) return '';
    return parts;
  } catch {
    return '';
  }
}

export function parseLocalDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  try {
    const dateStr = toLocalDateString(dateString);
    if (!dateStr) return null;

    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);

    if (isNaN(date.getTime())) return null;

    return date;
  } catch {
    return null;
  }
}

export function calculateDepositDueDate(
  eventDate: string,
  timing: string,
  customDate?: string
): string | null {
  if (!eventDate) return null;

  try {
    const dateStr = toLocalDateString(eventDate);
    if (!dateStr) return null;

    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;

    const [year, month, day] = parts;
    const event = new Date(year, month - 1, day);

    if (isNaN(event.getTime())) return null;

    switch (timing) {
      case '5_days_before':
        event.setDate(event.getDate() - 5);
        return toLocalDateString(event);
      case '30_days':
      case '30_days_before':
        event.setDate(event.getDate() - 30);
        return toLocalDateString(event);
      case '60_days':
      case '60_days_before':
        event.setDate(event.getDate() - 60);
        return toLocalDateString(event);
      case 'upon_signing':
        return toLocalDateString(new Date());
      case 'at_settlement':
        return toLocalDateString(event);
      case 'custom':
        return customDate || null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function getDaysUntil(targetDate: string | null): string {
  if (!targetDate) return 'Not set';

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateStr = toLocalDateString(targetDate);
    if (!dateStr) return 'Not set';

    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 'Not set';

    const [year, month, day] = parts;
    const target = new Date(year, month - 1, day);

    if (isNaN(target.getTime())) return 'Not set';

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)} days ago (OVERDUE)`;
    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  } catch {
    return 'Not set';
  }
}

export function getDaysUntilNumber(targetDate: string | null): number {
  if (!targetDate) return 999;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateStr = toLocalDateString(targetDate);
    if (!dateStr) return 999;

    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 999;

    const [year, month, day] = parts;
    const target = new Date(year, month - 1, day);

    if (isNaN(target.getTime())) return 999;

    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

export function formatDate(date: string | Date | null): string {
  if (!date) return 'Not set';

  try {
    const dateStr = toLocalDateString(date);
    if (!dateStr) return 'Not set';

    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 'Not set';

    const [year, month, day] = parts;
    const dateObj = new Date(year, month - 1, day);

    if (isNaN(dateObj.getTime())) return 'Not set';

    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Not set';
  }
}
