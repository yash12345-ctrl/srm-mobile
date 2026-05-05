const fs = require('fs');

// DASHBOARD
let dash = fs.readFileSync('app/dashboard.tsx', 'utf8');

// 1. replace runOnJS usage
dash = dash.replace(/runOnJS\(setCurrentIndex\)\(next\)/g, "const updateIndex = (idx) => setCurrentIndex(idx);\n      runOnJS(updateIndex)(next)");

// let's actually make a small function setIndexWrapper
dash = dash.replace(
`    flip.value = withTiming(dir * -90, { duration: 180 }, () => {
      runOnJS(setCurrentIndex)(next);`,
`    flip.value = withTiming(dir * -90, { duration: 180 }, () => {
      const setIdx = (i: number) => setCurrentIndex(i);
      runOnJS(setIdx)(next);`
);

// 2. nested functions issue
dash = dash.replace(
`    const findCourse = (slot: string) => {
      return timetable.courses.find((c: any) => {
        if (!c.slot || c.slot === 'TBD') return false;
        const scrapedSlots = c.slot.replaceAll(/[^a-zA-Z0-9]/g, ' ').split(/\\s+/);
        return scrapedSlots.some((s: string) => s === slot || (slot.length === 1 && s.startsWith(slot)));
      });
    };`,
`    const findCourse = (slot: string) => {
      return getCourseForSlot(timetable.courses, slot);
    };`
);
// inject getCourseForSlot at top level before DashboardScreen
dash = dash.replace(
`export default function DashboardScreen() {`,
`function getCourseForSlot(courses: any[], slot: string) {
  return courses.find((c: any) => {
    if (!c.slot || c.slot === 'TBD') return false;
    const scrapedSlots = c.slot.replaceAll(/[^a-zA-Z0-9]/g, ' ').split(/\\s+/);
    return scrapedSlots.some((s: string) => s === slot || (slot.length === 1 && s.startsWith(slot)));
  });
}

export default function DashboardScreen() {`
);

fs.writeFileSync('app/dashboard.tsx', dash);

// TIMETABLE
let timetable = fs.readFileSync('app/Timetable.tsx', 'utf8');

timetable = timetable.replace(
`              backgroundColor: isNow ? T.now : (isNext ? T.next : meta.color),
              borderColor:      isNow ? T.now + '30' : meta.color + '20',`,
`              backgroundColor: isNow ? T.now : isNext ? T.next : meta.color,
              borderColor: isNow ? T.now + '30' : meta.color + '20',`
); // wait, let's restructure this part more safely

