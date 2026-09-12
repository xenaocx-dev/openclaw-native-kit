// The one known route-only hook can decide preview eligibility using its own rules.
// Unknown/content-aware hooks retain the upstream blanket preview restriction.
import {S as getGlobalHookRunnerRegistry,s as createHookRunner} from './hook-runner-global-BhDCl4qm.mjs';
export async function allowTelegramRoutePreview({hookRunner,registry=getGlobalHookRunnerRegistry(),chatId,threadId,accountId,sessionKey}) {
 if(hookRunner?.hasHooks('reply_payload_sending'))return false;
 if(!hookRunner?.hasHooks('message_sending'))return true;
 if(chatId==null||!String(chatId).trim()||!accountId||!registry)return false;
 const typedHooks=[...(registry.typedHooks??[])];
 if(typedHooks.some(h=>h.hookName==='reply_payload_sending'))return false;
 const sending=typedHooks.filter(h=>h.hookName==='message_sending');
 if(!sending.length||sending.some(h=>h.pluginId!=='telegram-topic-mute'||h.registrationId!=='telegram-topic-mute:route-only:v1'))return false;
 try {
  // Snapshot exactly the inspected registry and use the official bounded runner.
  // Fail closed here even though ordinary message_sending defaults to fail open.
  const runner=createHookRunner({...registry,typedHooks},{catchErrors:false});
  const result=await runner.runMessageSending({to:String(chatId),threadId,content:''},
   {channelId:'telegram',accountId,conversationId:String(chatId),sessionKey});
  return result==null||(result.cancel!==true&&result.content==null&&result.metadata==null);
 }catch{return false;}
}

// 9.4 binding for v3.8 terminal ownership/physical-ID reconciliation and renderer.
// Pagination uses 9.4's official planner and draft stream, never a second sender.
import {C as planTelegramTextDeliveryPages} from './send-CybWWh28.mjs';
import {createChinesePresentation} from './openclaw-acp-reasoning-presentation-v38.mjs';
import {createTelegramAcpReasoningTerminalArbiter,prepareTelegramAcpReasoningPresentation,
 finalizeTelegramAcpReasoningTimeoutPresentation,createTelegramAcpReasoningTimeoutCleanupRunner,
 isTelegramSpooledHandlerTimeoutAbortReason,TELEGRAM_ACP_REASONING_TIMEOUT_NOTICE} from './openclaw-acp-reasoning-terminal-v38.mjs';
export function createAcpReasoningChannel(turn,deps) {
 const lane=turn.reasoningLane,stream=lane.stream,arbiter=createTelegramAcpReasoningTerminalArbiter();
 const ids=lane.acpObservedIds??=new Set();
 const committed=[];let rotationFailed=false,terminal=false,source='',background;
 const capture=()=>{const id=stream.messageId();if(Number.isSafeInteger(id))ids.add(id);};
 const ambiguous=()=>lane.acpPhysicalAmbiguous===true||stream.sendMayHaveLanded();
 const presentation=deps.presentation??createChinesePresentation(deps);
 const format=text=>deps.format(text);
 const plan=text=>(deps.plan??planTelegramTextDeliveryPages)({text:format(text),maxChars:Math.min(turn.textLimit??4096,4096),richMessages:false,tableMode:turn.tableMode});
 const sendPage=async(page,final)=>{
  stream.updatePreview({text:page.sourceText,parseMode:'HTML'});
  lane.hasStreamedMessage=true;lane.finalized=false;lane.lastPartialText=page.plainText;
  if(!final)return;
  await stream.stop();capture();
  const snapshot=stream.currentMessageSnapshot();
  if(!Number.isSafeInteger(stream.messageId())||!snapshot||snapshot.text.trimEnd()!==page.plainText.trimEnd()){
   lane.acpPhysicalAmbiguous||=stream.sendMayHaveLanded();throw Error('v3.8 strict reasoning page has no matching receipt');
  }
 };
 const advance=async(text,final)=>{
  source=text;const pages=plan(text);
  if(rotationFailed)return;
  // Same v2/v3.8 committed-prefix check; changed prefixes go through authoritative recovery.
  if(committed.some((x,i)=>pages[i]?.sourceText!==x)){rotationFailed=true;return;}
  try{
   const limit=final?pages.length:Math.max(0,pages.length-1);
   for(let i=committed.length;i<limit;i++){
    if(turn.isSuperseded())return;
    await sendPage(pages[i],true);committed.push(pages[i].sourceText);
    if(i<pages.length-1)stream.forceNewMessage();
   }
   if(!final&&pages[committed.length])await sendPage(pages[committed.length],false);
  }catch(error){rotationFailed=true;deps.logVerbose('ACP reasoning page retained for terminal recovery: '+String(error));}
 };
 const timeoutRunner=createTelegramAcpReasoningTimeoutCleanupRunner({finalize:({committed:notice})=>finalizeTelegramAcpReasoningTimeoutPresentation({
  messageIds:[...ids],getActiveMessageId:()=>stream.messageId(),discard:()=>stream.discard(),
  noticeText:TELEGRAM_ACP_REASONING_TIMEOUT_NOTICE,noticeAlreadyCommitted:notice.noticeCommitted,
  retainedNoticeMessageId:notice.primaryMessageId,editMessage:deps.edit,deleteMessage:id=>turn.bot.api.deleteMessage(turn.context.chatId,id),sendNotice:deps.sendNotice,log:deps.logVerbose}),log:deps.logVerbose});
 return {
  async preview(payload){if(terminal||turn.isSuperseded())return;await advance(payload.text,false);},
  async finalize(payload){
   if(terminal)return true;
   if(turn.isSuperseded())return true;
   await advance(payload.text,true);
   // Use v3.8 authoritative-source recovery even if a terminal tail had no receipt.
   const prepared=await prepareTelegramAcpReasoningPresentation({messageIds:[...ids],getMessageIds:()=>[...ids],getActiveMessageId:()=>stream.messageId(),
    isMessageSetAmbiguous:ambiguous,discard:()=>stream.discard(),maskMessage:(id,index,total)=>deps.edit(id,index===0?'🧠 正在整理中文推理…':`🧠 中文推理整理中…（${index+1}/${total}）`),log:deps.logVerbose});
   terminal=true;lane.finalized=true;
   if(!arbiter.claimNormal())return true;
   if(prepared.ambiguous){deps.logVerbose('[acp-reasoning-v3.8-port] ambiguous physical set preserved');return true;}
   if(!Number.isSafeInteger(prepared.primaryMessageId)){
    // No confirmed receipt: never replay raw text into a second delivery path.
    deps.logVerbose('[acp-reasoning-v3.8-port] no confirmed primary; original preview preserved');return true;
   }
   background=presentation.start({sourceText:source,primaryMessageId:prepared.primaryMessageId,messageIds:prepared.messageIds,canonicalMessageCount:committed.length,traceMode:rotationFailed?'terminal-recovery':'canonical'});
   void background.catch(error=>deps.logVerbose('ACP Chinese presentation failed: '+String(error)));
   return true;
  },
  async cleanup(){
   capture();const reason=turn.turnAdoptionLifecycle?.abortSignal?.reason;
   const updateIds=turn.context.ctxPayload.TelegramUpdateIds??turn.context.ctxPayload.TelegramUpdateId??turn.context.ctxPayload.UpdateId;
   if(isTelegramSpooledHandlerTimeoutAbortReason(reason,updateIds)&&arbiter.claimTimeout()){
    terminal=true;await timeoutRunner.request(turn.draftEventQueue);lane.finalized=true;return;
   }
   // v2 interrupted trace is retained; discard drains without materializing pending edits.
   await stream.discard();capture();lane.finalized=true;
  },
  background:()=>background,ids:()=>[...ids],committed:()=>committed.length
 };
}
