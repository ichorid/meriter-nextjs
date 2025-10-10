//10y2mo1w10d30h11m200s
export function parseTimeString(str) {
    let time = 0
    //  let [s, sEtc] = str.split('s');
    const sign = str[0] == '-' ? -1 : 1

    let s = str.replace('-', '').replace('+', '')

    if (s && s.match('y')) {
        let [y, yEtc] = s.split('y')
        time += parseInt(y) * 1000 * 60 * 60 * 24 * 365
        s = yEtc
    }
    if (s && s.match('mo')) {
        let [mo, moEtc] = s.split('mo')
        time += parseInt(mo) * 1000 * 60 * 60 * 24 * 30
        s = moEtc
    }
    if (s && s.match('w')) {
        let [w, wEtc] = s.split('w')
        time += parseInt(w) * 1000 * 60 * 60 * 24 * 7
        s = wEtc
    }
    if (s && s.match('d')) {
        let [d, dEtc] = s.split('d')
        time += parseInt(d) * 1000 * 60 * 60 * 24
        s = dEtc
    }
    if (s && s.match('h')) {
        let [h, hEtc] = s.split('h')
        time += parseInt(h) * 1000 * 60 * 60
        s = hEtc
    }
    if (s && s.match('m')) {
        let [m, mEtc] = s.split('m')
        time += parseInt(m) * 1000 * 60
        s = mEtc
    }
    if (s && s.match('s')) {
        let [sec, secEtc] = s.split('s')
        time += parseInt(sec) * 1000
        s = secEtc
    }
    return sign * time
}

//now+1
export function parseDateFormula(fl, subst: object) {
    if (!isNaN(new Date(fl).getDate())) return fl

    const addVal = fl.match('\\+') ? parseTimeString(fl.split('+')[1]) : fl.match('\\-') ? -parseTimeString(fl.split('-')[1]) : 0

    const val = Object.entries(subst).find(([k, v]) => fl.match(k))[1]
    return val + addVal
}

export function dateVerbose(ts: Date | string | number): string {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
        return `${diffSec} сек назад`;
    } else if (diffMin < 60) {
        return `${diffMin} мин назад`;
    } else if (diffHour < 24) {
        return `${diffHour} ч назад`;
    } else if (diffDay < 7) {
        return `${diffDay} дн назад`;
    } else {
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
}
