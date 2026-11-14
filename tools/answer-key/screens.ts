/**
 * The screens of Bhavin's platform whose figures are the answer key (the kept list in docs/plan/m4a-triage.md).
 * Each names the platform pages to open, any state to set first (the platform's own globals), and an optional
 * expression for structure the page only keeps in memory.
 */

export interface PageSpec {
  page: string;
  before?: string;
  wait?: string;
}

export interface ScreenSpec {
  id: string;
  pages: PageSpec[];
  extra?: string;
  noText?: boolean;
}

const COMPARE = "cmpCat='Vertical Machining Center'; cmpA='VC-28'; cmpB='VC-22';";
const FIX = "ffQ='spindle overload'; ffM=''; ffC='';";
const OCTOBER = 'repSel.m={y:2026,mo:9};';
const YEAR = 'repSel.y=2026;';
const NUDGES =
  'acCache.list.map(n=>({key:n.key,rule:n.rule,sev:n.sev,title:n.title,machines:n.machines,entries:(n.entries||[]).length}))';
const AC_RULES = 'AC_TYPES';
const FOCUS =
  'tfCache.acts.map(a=>({key:a.key,lane:a.lane,machine:a.mid,title:a.title,stake:Math.round(a.stake*100)/100,status:a.st,owner:a.owner,note:a.note}))';
const GUIDE =
  "[...document.querySelectorAll('#page-guide h2,#page-guide h3,#page-guide h4')].map(h=>h.textContent.trim())";
const SETTINGS =
  'Object.fromEntries(Object.entries(state.settings).filter(([k,v])=>typeof v==="number"||(Array.isArray(v)&&v.length<40&&v.every(x=>typeof x==="string"))))';

const ENERGY = 'calcEnergyHeatmap()';
const CHECKLIST =
  '({counts:dcCache.items.reduce((a,i)=>(a[i.group]=(a[i.group]||0)+1,a),{}),items:dcCache.items.map(i=>({group:i.group,key:i.key,plain:i.plain}))})';
const PM_FIGURES =
  '({year:pmYear(),cover:{none:pmCover().none.length,part:pmCover().part.length,full:pmCover().full.length},status:state.pmPlan.reduce((a,e)=>{const k=pmStat(e).k;a[k]=(a[k]||0)+1;return a},{})})';
const MACHINE =
  "(()=>{const m=getMachine('VC-28');return {machine:m,efficiencyPct:machEffPct(m),breakdowns:bdAll().filter(b=>b.machineId===m.id).length}})()";

const one = (page: string): { page: string }[] => [{ page }];

export const SCREENS: ScreenSpec[] = [
  { id: 'dashboard', pages: one('dashboard') },
  {
    id: 'registers',
    pages: ['machines', 'robots', 'conv', 'proc', 'util', 'dg'].map((page) => ({ page })),
  },
  { id: 'breakdown-log', pages: one('breakdowns') },
  { id: 'a1-bd-pm', pages: one('a1') },
  { id: 'a2-category-cell', pages: one('a2') },
  { id: 'a3-mttr-mtbf', pages: one('a3') },
  { id: 'a4-manpower', pages: one('a4') },
  { id: 'a5-energy', pages: one('a5'), extra: ENERGY, noText: true },
  { id: 'a6-why-why', pages: one('a6') },
  { id: 'a7-footprint', pages: one('a7') },
  { id: 'a8-age', pages: one('a8') },
  { id: 'a9-bottleneck-forecast', pages: one('a9') },
  { id: 'a10-problems', pages: one('a10') },
  {
    id: 'forecast-lab',
    pages: [
      {
        page: 'fl',
        wait: "!document.getElementById('page-fl').textContent.includes('Running the test')",
      },
    ],
  },
  { id: 'compare', pages: [{ page: 'cmp', before: COMPARE }] },
  { id: 'team-focus', pages: one('tf'), extra: FOCUS, noText: true },
  { id: 'money-matters', pages: one('mm') },
  { id: 'fix-finder', pages: [{ page: 'ff', before: FIX }] },
  {
    id: 'action-center',
    pages: one('ac'),
    extra: `({types:${AC_RULES},thresholds:acCfg(),acks:state.settings.acAcks,nudges:${NUDGES}})`,
  },
  { id: 'monthly-report', pages: [{ page: 'rep_month', before: OCTOBER }] },
  { id: 'annual-report', pages: [{ page: 'rep_year', before: `${OCTOBER} ${YEAR}` }] },
  { id: 'data-checklist', pages: one('dc'), extra: CHECKLIST },
  { id: 'pm-plan', pages: one('pm'), extra: PM_FIGURES },
  { id: 'guide', pages: one('guide'), extra: GUIDE, noText: true },
  { id: 'legacy-settings', pages: one('settings'), extra: SETTINGS, noText: true },
  {
    id: 'machine-page',
    pages: [
      { page: 'asset', before: "assetKind='machines'; assetId='VC-28'; assetFrom='list';" },
      { page: 'mdetail', before: "mdetailId='VC-28'; mdetailFrom='dashboard';" },
    ],
    extra: MACHINE,
  },
  { id: 'oem-analytics', pages: one('oem') },
  { id: 'general-work', pages: one('gw') },
];
