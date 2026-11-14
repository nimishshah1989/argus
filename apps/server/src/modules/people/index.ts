import { defineModule } from '../../kernel/index.js';
import { registerPeopleRoutes } from './routes.js';

export const peopleModule = defineModule({ name: 'people', register: registerPeopleRoutes });
