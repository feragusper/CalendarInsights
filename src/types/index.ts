export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  duration: number;
  colorId?: string;
  calendarId: string;
}

export interface TimeBreakdown {
  category: string;
  totalMinutes: number;
  totalHours: number;
  percentage: number;
  color: string;
  eventCount: number;
}

export interface DailyBreakdown {
  date: string;
  label: string;
  totalMinutes: number;
  totalHours: number;
  categories: TimeBreakdown[];
}

export type DateRange = "day" | "week" | "month" | "year" | "custom";

export interface DateFilter {
  range: DateRange;
  startDate: string;
  endDate: string;
}
