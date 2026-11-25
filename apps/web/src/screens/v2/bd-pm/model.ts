import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/**
 * The BD % and PM split page: the engine's printed page plus each table's computed line (ADR 0035, ticket 658), keyed
 * `cell`, `bd-share`, `pm-share`, `bd-hours`, `pm-hours` in the engine's table order. Kept in this folder so the shared
 * `PrintedPageModel` stays untouched.
 */
export type BdPmModel = PrintedPageModel & { takeaways?: Takeaways };
