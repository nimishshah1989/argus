import { gujarati } from './blank.js';
import { jobsEn } from './jobs.en.js';

export const jobsGu = gujarati(jobsEn, {
  'jobs.menu': 'બેકગ્રાઉન્ડ જોબ',
  'jobs.menu.sub': 'નિષ્ફળ ગયેલી જોબ અને ફરી પ્રયાસ',
  'jobs.menu.withCount': 'બેકગ્રાઉન્ડ જોબ, {{n}} નિષ્ફળ',
  'jobs.title': 'બેકગ્રાઉન્ડ જોબ',
  'jobs.intro':
    'સિસ્ટમ જાતે કરે છે તે કામ, જેમ કે એલર્ટ મોકલવા. નિષ્ફળ ગયેલી જોબ કારણ સાથે અહીં દેખાય છે. ફરી પ્રયાસ તેને ફરી એક વાર ચલાવે છે.',
  'jobs.empty': 'કોઈ જોબ નિષ્ફળ નથી. બધું ચાલ્યું.',
  'jobs.count': '{{n}} નિષ્ફળ',
  'jobs.tag.failed': 'નિષ્ફળ',
  'jobs.tag.running': 'ચાલી રહી છે',
  'jobs.tag.retryFailed': 'ફરી પ્રયાસ નિષ્ફળ',
  'jobs.failedAt': 'નિષ્ફળ {{when}}',
  'jobs.attempts_one': '{{count}} પ્રયાસ',
  'jobs.attempts_other': '{{count}} પ્રયાસ',
  'jobs.retry': 'ફરી પ્રયાસ',
  'jobs.retryJob': 'ફરી પ્રયાસ: {{kind}}',
  'jobs.retrying': 'ચાલી રહી છે…',
  'jobs.retried': '{{kind}} ફરી ચલાવાઈ. તે યાદીમાંથી નીકળી ગઈ.',
  'jobs.retryError': '{{kind}} ફરી ચલાવી શકાઈ નહીં. ફરી પ્રયાસ કરો.',
  'jobs.noError': 'આ નિષ્ફળતાનું કારણ સચવાયું નથી.',
  'jobs.noAccess': 'બેકગ્રાઉન્ડ જોબ એડમિન અને હેડ માટે છે',
  'jobs.kind.ai.suggest': 'એઆઈ સૂચન',
  'jobs.kind.ops.watch': 'સિસ્ટમ દેખરેખ',
  'jobs.kind.sla.timer': 'પ્રતિસાદ ટાઇમર',
  'jobs.kind.sla.escalate': 'એસ્કેલેશન',
  'jobs.kind.register.due': 'રજિસ્ટરની નિયત તારીખો',
  'jobs.kind.notify.send': 'એલર્ટ મોકલવું',
  'jobs.kind.notify.sweep': 'એલર્ટ તપાસ',
  'jobs.kind.pm.generate': 'આયોજિત જાળવણી ટિકિટ',
  'jobs.kind.engine.run': 'એનાલિટિક્સ રન',
  'jobs.kind.engine.freeze': 'એનાલિટિક્સ માસ બંધ',
  'jobs.noAccess.body':
    'નિષ્ફળ જોબ જોવા પ્લાન્ટ એડમિન કે હેડ તરીકે તમારા પોતાના લૉગિનથી સાઇન ઇન કરો.',
});
