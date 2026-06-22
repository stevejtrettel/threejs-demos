// Register the @/ alias resolver hook, then this can be passed via --import.
import { register } from 'node:module';
register('./alias-hooks.mjs', import.meta.url);
