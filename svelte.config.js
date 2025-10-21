import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: '404.html'
		}),
		paths: {
			// In dev mode keep base '', otherwise prefer an explicit BASE_PATH env var
			// (use an explicit empty string to build as a root site for custom domains)
			base: process.argv.includes('dev') ? '' : (process.env.BASE_PATH !== undefined ? process.env.BASE_PATH : '/cyber_purok')
		}
	}
};

export default config;