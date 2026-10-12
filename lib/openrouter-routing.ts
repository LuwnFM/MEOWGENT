/** Shared budget-first OpenRouter model routing. Server-side only. */
export type ModelInfo = { id: string; pricing?: { prompt?: string; completion?: string }; context_length?: number; supported_parameters?: string[] };
const catalogUrl = 'https://openrouter.ai/api/v1/models';
let catalogCache: { until: number; models: ModelInfo[] } | undefined;
export type RoutingTier = 'fast' | 'balanced' | 'complex';

export function tierFromMessages(messages: {content:string}[]): RoutingTier {
  const text = messages.map(x=>x.content).join(' ').toLowerCase();
  if (text.length > 12000 || /архитектур|architecture|security audit|аудит безопасност|refactor|рефактор|сложн|complex|debug|отладк/.test(text)) return 'complex';
  if (text.length > 2500 || /код|code|script|скрипт|analyse|анализ|план/.test(text)) return 'balanced';
  return 'fast';
}
export function safeNumber(value: unknown): number {
  const n = Number(value);
  return typeof value === 'string' || typeof value === 'number' ? (Number.isFinite(n) && n >= 0 ? n : Infinity) : Infinity;
}
export function estimateCost(model: ModelInfo, promptTokens: number, completionTokens: number): number {
  const p = safeNumber(model.pricing?.prompt), c = safeNumber(model.pricing?.completion);
  return p * promptTokens + c * completionTokens;
}
export async function getCatalog(): Promise<ModelInfo[]> {
  if (catalogCache && catalogCache.until > Date.now()) return catalogCache.models;
  const r = await fetch(catalogUrl, {signal:AbortSignal.timeout(10000),headers: process.env.OPENROUTER_API_KEY ? {Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`} : {}});
  if (!r.ok) throw new Error('Model discovery unavailable');
  const data = await r.json() as {data?:ModelInfo[]};
  const models = (data.data || []).filter(m=>typeof m.id === 'string');
  if (!models.length) throw new Error('No models available');
  catalogCache = {until:Date.now()+300000, models};
  return models;
}
export function selectModels(models: ModelInfo[], tier: RoutingTier): string[] {
  const budget = Math.max(0,Number(process.env.OPENROUTER_MAX_ESTIMATED_USD_PER_REQUEST || '0.01'));
  const output = tier === 'complex' ? 1800 : tier === 'balanced' ? 900 : 400;
  const input = tier === 'complex' ? 6000 : tier === 'balanced' ? 2500 : 1000;
  const priority = (process.env.OPENROUTER_PREFERRED_MODELS || 'z-ai/glm-5.2:free,deepseek/deepseek-v3.2,openai/gpt-oss-20b:free')
    .split(',').map(s=>s.trim()).filter(Boolean);
  const lookup = new Map(models.map(m=>[m.id,m]));
  const preferred = priority.filter(id=>lookup.has(id));
  const preferredFree = preferred.filter(id=> estimateCost(lookup.get(id)!,input,output)===0);
  const pool = models.filter(m=>{
    if (m.context_length && m.context_length < input+output) return false;
    const price=estimateCost(m,input,output);
    return Number.isFinite(price) && price<=budget;
  }).sort((a,b)=>{
    const aCost=estimateCost(a,input,output),bCost=estimateCost(b,input,output);
    return aCost-bCost || a.id.localeCompare(b.id);
  });
  const preferredPaid = preferred.filter(id=> !preferredFree.includes(id) && pool.some(m=>m.id===id));
  // Free models first; prioritize the configured list, then eligible priced models.
  const free = pool.filter(m=>estimateCost(m,input,output)===0).map(m=>m.id);
  return [...new Set([...preferredFree,...free,...preferredPaid,...pool.map(m=>m.id)])].slice(0,12);
}
