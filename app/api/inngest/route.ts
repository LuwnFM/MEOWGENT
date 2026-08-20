import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';

const auditJob = inngest.createFunction(
  { id: 'agent-job-audit', triggers: [{ event: 'agent/job.created' }] },
  async ({ event, step }) => step.run('record-dispatch', async () => ({ taskId: event.data.taskId, accepted: true })),
);

export const { GET, POST, PUT } = serve({ client: inngest, functions: [auditJob] });