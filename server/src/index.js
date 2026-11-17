import 'dotenv/config';
import { createApp } from './app.js';
import { startRevealNotifier } from './jobs/revealNotifier.job.js';
import { startUnresolvedCloser } from './jobs/unresolvedCloser.job.js';

const PORT = process.env.PORT ?? 3000;

createApp().listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startRevealNotifier();
  startUnresolvedCloser();
});
