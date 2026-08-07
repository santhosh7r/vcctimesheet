import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, isBefore, isAfter, isSameDay, endOfWeek } from 'date-fns';

export function getBiweeklyPeriods(year, month) {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  return [{
    label: `${format(monthStart, 'MMM')} 1 - ${format(monthStart, 'MMM')} ${monthEnd.getDate()}, ${year}`,
    start: monthStart,
    end: monthEnd,
  }];
}

export function getWeekRanges(start, end) {
  const weeks = [];
  let current = new Date(start);

  while (isBefore(current, end) || isSameDay(current, end)) {
    const weekStart = current;
    let weekEnd = endOfWeek(current, { weekStartsOn: 1 });
    if (isAfter(weekEnd, end)) weekEnd = end;

    weeks.push({ start: weekStart, end: weekEnd });
    current = addDays(weekEnd, 1);
  }

  return weeks;
}

export function getDaysInRange(start, end) {
  return eachDayOfInterval({ start: new Date(start), end: new Date(end) });
}

export function isWeekend(date) {
  const d = new Date(date);
  return d.getDay() === 0 || d.getDay() === 6;
}
