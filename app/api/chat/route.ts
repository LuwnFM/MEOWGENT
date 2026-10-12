import { NextResponse } from 'next/server';
import { verifyAccessCode, accessCodeFromRequest } from '@/lib/security';
import { getCatalog, selectModels, tierFromMessages } from '@/lib/openrouter-routing';

export const runtime = 'nodejs';
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ProviderMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type CompletionResponse = {choices?:Array<{message?:{content?:string}}>;model?:string};

async function completion(url:string,key:string,models:string[],messages:ProviderMessage[],title:string) {
  const response = await fetch(url, {
    method:'POST', signal:AbortSignal.timeout(45000),
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`,'X-Title':title},
    body:JSON.stringify({
      model:models[0], ...(url.includes('openrouter.ai') ? {models:models.slice(0,5)} : {}),
      messages, max_tokens: 1200,
    }),
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const data=await response.json() as CompletionResponse;
  const content=data.choices?.[0]?.message?.content;
  if(typeof content!=='string' || !content.trim()) throw new Error('Provider returned empty response');
  return {content,model:data.model||models[0]};
}

export async function POST(req:Request) {
  try {
    const body=await req.json() as {accessCode?:unknown;messages?:unknown};
    if(!verifyAccessCode(accessCodeFromRequest(req) ?? body.accessCode)) return NextResponse.json({error:'Unauthorized'},{status:401});
    if(!Array.isArray(body.messages)) return NextResponse.json({error:'Invalid messages'},{status:400});
    if(body.messages.length>20) return NextResponse.json({error:'Too many messages'},{status:400});
    const messages=body.messages.filter((item:unknown):item is ChatMessage=>{
      if(!item||typeof item!=='object') return false;
      const m=item as Partial<ChatMessage>;
      return (m.role==='user'||m.role==='assistant')&&typeof m.content==='string'&&m.content.trim().length>0&&m.content.length<=8000;
    });
    if(messages.length!==body.messages.length||!messages.some(m=>m.role==='user')) return NextResponse.json({error:'Invalid messages'},{status:400});
    const system:ProviderMessage={role:'system',content:'You are a concise cybersecurity assistant. Only perform authorized defensive and testing tasks.'};
    // System role is constructed separately: never trust client-provided system messages.
    const payload:ProviderMessage[] = [system,...messages];
    const tier=tierFromMessages(messages);
    const errors:string[]=[];
    if(process.env.OPENROUTER_API_KEY) {
      try {
        const catalog=await getCatalog();
        const models=selectModels(catalog,tier);
        if(models.length) {
          const result=await completion('https://openrouter.ai/api/v1/chat/completions',process.env.OPENROUTER_API_KEY,models,payload,'SecOps MEOWGENT');
          return NextResponse.json({...result,provider:'openrouter',tier});
        }
      } catch(err) { errors.push('OpenRouter unavailable'); console.warn('OpenRouter chat request failed',err); }
    }
    // Optional independent providers, enabled only when corresponding keys exist.
    if(process.env.GROQ_API_KEY) {
      try {
        const result=await completion('https://api.groq.com/openai/v1/chat/completions',process.env.GROQ_API_KEY,[process.env.GROQ_MODEL||'llama-3.3-70b-versatile'],payload,'SecOps MEOWGENT');
        return NextResponse.json({...result,provider:'groq',tier});
      } catch(err) { errors.push('Groq unavailable'); console.warn('Groq chat request failed',err); }
    }
    if(process.env.MISTRAL_API_KEY) {
      try {
        const result=await completion('https://api.mistral.ai/v1/chat/completions',process.env.MISTRAL_API_KEY,[process.env.MISTRAL_MODEL||'mistral-small-latest'],payload,'SecOps MEOWGENT');
        return NextResponse.json({...result,provider:'mistral',tier});
      } catch(err) { errors.push('Mistral unavailable'); console.warn('Mistral chat request failed',err); }
    }
    return NextResponse.json({error:errors.length?'All configured chat providers failed':'No chat provider is configured'},{status:503});
  } catch {
    return NextResponse.json({error:'Unable to process chat request'},{status:500});
  }
}
