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
        //    console.log('y',y,s);
    }
    if (s && s.match('mo')) {
        let [mo, moEtc] = s.split('mo')
        time += parseInt(mo) * 1000 * 60 * 60 * 24 * 30
        s = moEtc
        //  console.log('mo',mo,s);
    }
    if (s && s.match('w')) {
        let [w, wEtc] = s.split('w')
        time += parseInt(w) * 1000 * 60 * 60 * 24 * 7
        s = wEtc
        //       console.log('w',w,s);
    }
    if (s && s.match('d')) {
        let [d, dEtc] = s.split('d')
        time += parseInt(d) * 1000 * 60 * 60 * 24
        s = dEtc
        //       console.log('d',d,s);
    }
    if (s && s.match('h')) {
        let [h, hEtc] = s.split('h')
        time += parseInt(h) * 1000 * 60 * 60
        s = hEtc
        //    console.log('h',h,s);
    }
    if (s && s.match('m')) {
        let [m, mEtc] = s.split('m')
        time += parseInt(m) * 1000 * 60
        s = mEtc
        //      console.log('m',m,s);
    }
    if (s && s.match('s')) {
        let [sec, secEtc] = s.split('s')
        time += parseInt(sec) * 1000
        s = secEtc
        //console.log('s',sec,s);
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
