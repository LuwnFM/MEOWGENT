const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadRouting() {
  const source = fs.readFileSync('lib/openrouter-routing.ts','utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  const context = {exports,process:{env:{}},fetch:async()=>{throw Error('unexpected network request')},AbortSignal,Date,Number,Map,Set,Infinity};
  vm.runInNewContext(js,context,{filename:'openrouter-routing.js'});
  return {api:exports,context};
}
const model=(id,prompt,completion,context_length=32000)=>({id,pricing:{prompt:String(prompt),completion:String(completion)},context_length});

test('cost estimates and malformed prices',()=>{
  const {api}=loadRouting();
  assert.equal(api.estimateCost(model('free',0,0),1000,500),0);
  assert.equal(api.estimateCost(model('paid',0.000001,0.000002),1000,500),0.002);
  assert.equal(api.safeNumber('invalid'),Infinity);
  assert.equal(api.safeNumber('-1'),Infinity);
});

test('prefers eligible free model, excludes over-budget and unknown prices',()=>{
  const {api,context}=loadRouting();
  context.process.env.OPENROUTER_PREFERRED_MODELS='expensive,free,unknown';
  context.process.env.OPENROUTER_MAX_ESTIMATED_USD_PER_REQUEST='0.001';
  const selected=api.selectModels([
    model('expensive',0.001,0.001),
    model('free',0,0),
    {id:'unknown'},
    model('cheap',0.0000001,0.0000001),
  ],'fast');
  assert.equal(selected[0],'free');
  assert.ok(selected.includes('cheap'));
  assert.ok(!selected.includes('expensive'));
  assert.ok(!selected.includes('unknown'));
});

test('does not select free model with insufficient context',()=>{
  const {api,context}=loadRouting();
  context.process.env.OPENROUTER_PREFERRED_MODELS='short,long';
  const selected=api.selectModels([model('short',0,0,100),model('long',0,0,32000)],'complex');
  assert.equal(selected[0],'long');
  assert.ok(!selected.includes('short'));
});

test('classifies request complexity',()=>{
  const {api}=loadRouting();
  assert.equal(api.tierFromMessages([{content:'hi'}]),'fast');
  assert.equal(api.tierFromMessages([{content:'Напиши код'}]),'balanced');
  assert.equal(api.tierFromMessages([{content:'architecture review'}]),'complex');
});

test('catalog is cached for repeated requests',async()=>{
  const {api,context}=loadRouting();
  let calls=0;
  context.fetch=async()=>{calls++;return {ok:true,json:async()=>({data:[model('free',0,0)]})};};
  await api.getCatalog();
  await api.getCatalog();
  assert.equal(calls,1);
});
