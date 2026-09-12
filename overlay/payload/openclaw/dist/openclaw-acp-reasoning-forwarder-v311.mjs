// v2 cumulative stream/finalizer contract, carried by the 9.4 callback bridge.
import {o as createDraftStreamLoop} from './draft-stream-controls-C9oD8ud-.mjs';
export function createReasoningForwarder(params) {
 let text='',boundary=false,closed=false,stopped=false,truncated=false,lastPreviewAt=0;
 const snapshot=()=>text+(truncated?'\n\n[reasoning truncated]':'');
 const loop=createDraftStreamLoop({throttleMs:250,isStopped:()=>stopped||params.signal?.aborted===true,
  sendOrEditStreamMessage:async value=>{const wait=250-(Date.now()-lastPreviewAt);if(wait>0)await new Promise(r=>setTimeout(r,wait));if(stopped||params.signal?.aborted)return true;lastPreviewAt=Date.now();try{await params.onStream?.({text:value,isReasoning:true,isReasoningSnapshot:true,channelData:{openclawAcpReasoningPreview:true}});}catch{params.onError?.('preview');}return true;},onBackgroundFlushError:()=>params.onError?.('preview')});
 const close=async cancelled=>{
  if(closed)return;closed=true;
  if(cancelled||params.signal?.aborted){stopped=true;loop.stop();await loop.waitForInFlight();return;}
  if(!text)return;
  loop.update(snapshot());await loop.flush();stopped=true;loop.stop();await loop.waitForInFlight();
  const payload={text:snapshot(),isReasoning:true,isReasoningSnapshot:true,channelData:{openclawAcpReasoningFinal:true}};
  let retained=false;
  if(params.durable&&params.onFinalize)try{retained=await params.onFinalize(payload)===true;}catch{params.onError?.('retain');}
  if(params.durable&&!retained)await params.deliver('tool',payload,{skipTts:true});
  await params.onEnd?.();
 };
 return {async onEvent(e){
  if(params.enabled!==true||closed||params.signal?.aborted)return;
  if(e.type==='text_delta'&&e.stream==='thought'&&e.tag==='agent_thought_chunk'&&typeof e.text==='string'){
   const next=(boundary&&text?'\n\n':'')+e.text;boundary=false;
   const room=Math.max(0,24000-text.length);let accepted=next.slice(0,room);
   if(accepted.length<next.length&&/[\uD800-\uDBFF]$/.test(accepted))accepted=accepted.slice(0,-1);
   truncated||=accepted.length<next.length;text+=accepted;
   if(params.onStream)loop.update(snapshot());
  }else if(e.type==='done')await close(e.status==='cancelled');
  else if(text){boundary=true;if(e.type==='tool_call'||e.type==='text_delta'&&(!e.stream||e.stream==='output'))void loop.flush();}
 },close:()=>close(false)};
}
