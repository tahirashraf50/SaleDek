import {
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";

export const DASHBOARD_RANGE_IDS = [
  "today",
  "7d",
  "30d",
  "month",
  "custom",
] as const;

export type DashboardRangeId = (typeof DASHBOARD_RANGE_IDS)[number];

export type ResolvedDashboardRange = {
  rangeId: DashboardRangeId;
  from: string;
  to: string;
  label: string;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
};

function isRangeId(v: string | undefined): v is DashboardRangeId {
  return !!v && (DASHBOARD_RANGE_IDS as readonly string[]).includes(v);
}

function parseYmd(value: string | undefined, fallback: Date): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  try {
    return parseISO(value);
  } catch {
    return fallback;
  }
}

/** Resolve dashboard From–To from URL search params with standard presets. */
export function resolveDashboardRange(params: {
  range?: string;
  from?: string;
  to?: string;
  now?: Date;
}): ResolvedDashboardRange {
  const now = params.now ?? new Date();
  const todayEnd = endOfDay(now);
  let rangeId: DashboardRangeId = isRangeId(params.range) ? params.range : "7d";

  let start: Date;
  let end: Date;
  let label: string;

  if (rangeId === "custom") {
    const rawFrom = parseYmd(params.from, subDays(now, 6));
    const rawTo = parseYmd(params.to, now);
    start = startOfDay(rawFrom <= rawTo ? rawFrom : rawTo);
    end = endOfDay(rawFrom <= rawTo ? rawTo : rawFrom);
    label = `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
  } else if (rangeId === "30d") {
    start = startOfDay(subDays(now, 29));
    end = todayEnd;
    label = "Last 30 days";
  } else if (rangeId === "month") {
    start = startOfMonth(now);
    end = endOfMonth(now);
    label = format(now, "MMMM yyyy");
  } else if (rangeId === "today") {
    start = startOfDay(now);
    end = todayEnd;
    label = "Today";
  } else {
    rangeId = "7d";
    start = startOfDay(subDays(now, 6));
    end = todayEnd;
    label = "Last 7 days";
  }

  const spanMs = Math.max(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs);

  return {
    rangeId,
    from: format(start, "yyyy-MM-dd"),
    to: format(end, "yyyy-MM-dd"),
    label,
    start,
    end,
    prevStart,
    prevEnd,
  };
}
