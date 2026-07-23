import app from './app.js';
import env from './config/env/env.config.js';
import { startCronScheduler } from './cron/index.js';

app.listen(env.port, () => {
  console.log(`API escuchando en puerto ${env.port}`);
  startCronScheduler();
});
