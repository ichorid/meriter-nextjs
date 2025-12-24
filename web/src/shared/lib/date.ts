/**
 * Date formatting and manipulation utilities
 */

//10y2mo1w10d30h11m200s
export function parseTimeString(str: string) {
    let time = 0
    //  let [s, sEtc] = str.split('s');
    const sign = str[0] == '-' ? -1 : 1

    let s = str.replace('-', '').replace('+', '')

    if (s && s.match('y')) {
        let [y, yEtc] = s.split('y')
        time += parseInt(y || '0') * 1000 * 60 * 60 * 24 * 365
        s = yEtc || ''
    }
    if (s && s.match('mo')) {
        let [mo, moEtc] = s.split('mo')
        time += parseInt(mo || '0') * 1000 * 60 * 60 * 24 * 30
        s = moEtc || ''
    }
    if (s && s.match('w')) {
        let [w, wEtc] = s.split('w')
        time += parseInt(w || '0') * 1000 * 60 * 60 * 24 * 7
        s = wEtc || ''
    }
    if (s && s.match('d')) {
        let [d, dEtc] = s.split('d')
        time += parseInt(d || '0') * 1000 * 60 * 60 * 24
        s = dEtc || ''
    }
    if (s && s.match('h')) {
        let [h, hEtc] = s.split('h')
        time += parseInt(h || '0') * 1000 * 60 * 60
        s = hEtc || ''
    }
    if (s && s.match('m')) {
        let [m, mEtc] = s.split('m')
        time += parseInt(m || '0') * 1000 * 60
        s = mEtc || ''
    }
    if (s && s.match('s')) {
        let [sec, secEtc] = s.split('s')
        time += parseInt(sec || '0') * 1000
        s = secEtc || ''
    }
    return sign * time
}

//now+1
export function parseDateFormula(fl: string, subst: object) {
    if (!isNaN(new Date(fl).getDate())) return fl

    const addVal = fl.match('\\+') ? parseTimeString(fl.split('+')[1] || '') : fl.match('\\-') ? -parseTimeString(fl.split('-')[1] || '') : 0

    const val = Object.entries(subst).find(([k, _v]) => fl.match(k))?.[1] || 0
    return val + addVal
}

export function dateVerbose(ts: Date | string | number, locale: string = 'en'): string {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
        return `${diffSec}s ago`;
    } else if (diffMin < 60) {
        return `${diffMin}m ago`;
    } else if (diffHour < 24) {
        return `${diffHour}h ago`;
    } else if (diffDay < 7) {
        return `${diffDay}d ago`;
    } else {
        return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
}

/**
 * Format a date with various format options
 */
export function formatDate(date: string | Date, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'relative') {
    return getRelativeTime(d);
  }
  
  const options: Intl.DateTimeFormatOptions = 
    format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
  
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'just now';
}

/**
 * Check if a value is a valid Date object
 */
export function isValidDate(date: unknown): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}