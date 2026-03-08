import { format, subDays, startOfMonth, startOfYear } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const PRESETS = [
  { label: 'Today', get: () => ({ from: new Date(), to: new Date() }) },
  { label: '7 days', get: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: '30 days', get: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'This month', get: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'This year', get: () => ({ from: startOfYear(new Date()), to: new Date() }) },
  { label: 'All time', get: () => ({ from: undefined, to: undefined }) },
];

interface Props {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}

const DateRangeFilter = ({ dateRange, onChange }: Props) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map(p => {
          const preset = p.get();
          const isActive =
            (!dateRange.from && !preset.from) ||
            (dateRange.from && preset.from && format(dateRange.from, 'yyyy-MM-dd') === format(preset.from, 'yyyy-MM-dd') &&
             dateRange.to && preset.to && format(dateRange.to, 'yyyy-MM-dd') === format(preset.to, 'yyyy-MM-dd'));
          return (
            <Button key={p.label} variant={isActive ? 'default' : 'outline'} size="sm" className="text-xs h-8" onClick={() => onChange(p.get())}>
              {p.label}
            </Button>
          );
        })}
      </div>

      {/* Custom pickers */}
      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", !dateRange.from && "text-muted-foreground")}>
              <CalendarIcon className="h-3 w-3" />
              {dateRange.from ? format(dateRange.from, 'dd MMM yyyy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateRange.from} onSelect={(d) => onChange({ ...dateRange, from: d })} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">—</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", !dateRange.to && "text-muted-foreground")}>
              <CalendarIcon className="h-3 w-3" />
              {dateRange.to ? format(dateRange.to, 'dd MMM yyyy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateRange.to} onSelect={(d) => onChange({ ...dateRange, to: d })} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default DateRangeFilter;

/** Utility: filter an array by date field within range */
export const filterByDateRange = <T,>(items: T[], dateField: keyof T, range: DateRange): T[] => {
  if (!range.from && !range.to) return items;
  return items.filter(item => {
    const d = new Date(item[dateField] as string);
    if (range.from && d < new Date(format(range.from, 'yyyy-MM-dd'))) return false;
    if (range.to && d > new Date(format(range.to, 'yyyy-MM-dd') + 'T23:59:59')) return false;
    return true;
  });
};
