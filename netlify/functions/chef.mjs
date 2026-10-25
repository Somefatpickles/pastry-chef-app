import { publicChef } from '../../server/netlify-runtime.mjs';
export default publicChef;
export const config = { path: '/api/chef', rateLimit: { windowLimit: 8, windowSize: 180, aggregateBy: ['ip', 'domain'] } };
