import Redis from 'ioredis';

export type AgentJob = { taskId: number; instruction: string; fileKeys: string[] };

let redis: Redis | null = null;

function connection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is not configured');
  redis ??= new Redis(url, { maxRetriesPerRequest: 2 });
  return redis;
}

export async function enqueueAgentJob(job: AgentJob) {
  await connection().lpush(process.env.REDIS_QUEUE ?? 'agent:jobs', JSON.stringify(job));
}