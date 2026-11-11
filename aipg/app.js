/* ============================================================
 * 智学云 · AI 批改工具  (aipg)
 * 5 步向导：题目提取 → 题目校对 → 答案获取 → 答案对应 → 批改留痕
 * AI 仅作辅助，所有结果均可手动修改
 * ============================================================ */

const OPENROUTER_KEY = atob('c2stb3ItdjEtYTY1MmQyZTlkZmM5Zjc3ZjI4MmNlMzU3N2IwZDllYzE1Yzk5MzhmMGFmMzc3MDM3YWI2OWIzYmU5MDQ4YWQwYQ==');
const VISION_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
const VISION_FALLBACKS = ['nvidia/nemotron-nano-12b-v2-vl:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'];
const TEXT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const TEXT_FALLBACKS = ['nvidia/nemotron-3.5-lightning:free', 'nvidia/nemotron-3.5-super-vl:free'];
const STORE_KEY = 'aipg_state_v1';

/* ---------- 持久化状态 ---------- */
const defaultState = () => ({
  step: 1,
  questions: [],        // [{id, text, aiNote}]
  answers: [],          // [{id, text, source:'photo'|'file'|'ai', confirmed}]
  mapping: [],          // [{qid, aid}]  qid -> aid
  roster: [],           // [{class, subject, students:[{id,name}]}]
  mode: 'roster',       // 'roster' | 'plain'
  submissions: []       // [{id, studentId, studentName, photos:[dataURL], marks:[{qid,correct,x,y}], done}]
});
let state = loadState();
function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(STORE_KEY)||'null');
    if(s && typeof s==='object') return Object.assign(defaultState(), s);
  }catch(e){}
  return defaultState();
}
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function uid(){ return Math.random().toString(36).slice(2,9); }

/* ---------- OpenRouter 调用 ---------- */
async function openrouter(messages, {model=VISION_MODEL, fallbacks=[], maxTokens=1500, temperature=0.3, signal}={}){
  const chain = [model, ...fallbacks];
  let lastErr = null;
  for(const m of chain){
    try{
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST', signal,
        headers:{
          'Authorization':'Bearer '+OPENROUTER_KEY,
          'Content-Type':'application/json',
          'HTTP-Referer': location.origin + '/aipg/',
          'X-Title':'ZhiXueYun AI Grading'
        },
        body: JSON.stringify({
          model: m, messages,
          max_tokens: maxTokens, temperature, top_p: 0.9,
          response_format: { type:'json_object' }
        })
      });
      if(!res.ok){ let d=''; try{ d=(await res.json()).error?.message||''; }catch(e){} throw new Error('HTTP '+res.status+(d?': '+d:'')); }
      const j = await res.json();
      const txt = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      return txt;
    }catch(e){
      lastErr = e;
      if(e && e.name==='AbortError') throw e;
    }
  }
  throw lastErr || new Error('AI 调用失败');
}

/* 多模态：传入 base64 图片 */
function imgPart(dataUrl){ return {type:'image_url', image_url:{url:dataUrl}}; }

async function aiVision(images, system, userText, opts={}){
  const parts = [{type:'text', text: userText}];
  (images||[]).forEach(d=> parts.push(imgPart(d)));
  const messages = [
    {role:'system', content: system},
    {role:'user', content: parts}
  ];
  return openrouter(messages, {model:VISION_MODEL, fallbacks:VISION_FALLBACKS, ...opts});
}
async function aiText(system, userText, opts={}){
  const messages = [
    {role:'system', content: system},
    {role:'user', content: userText}
  ];
  return openrouter(messages, {model:TEXT_MODEL, fallbacks:TEXT_FALLBACKS, ...opts});
}

/* 提取 JSON 块（容忍模型多写了说明文字） */
function extractJSON(txt){
  if(!txt) return null;
  const m = txt.match(/\{[\s\S]*\}/) || txt.match(/\[[\s\S]*\]/);
  if(!m) return null;
  try{ return JSON.parse(m[0]); }catch(e){ return null; }
}

/* ---------- 文件解析 ---------- */
async function parseFile(file){
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop();
  if(['txt','md','json','csv','log'].includes(ext)){
    return await file.text();
  }
  if(ext==='docx'){
    const zip = await JSZip.loadAsync(file);
    const xml = await zip.file('word/document.xml').async('string');
    // 提取 <w:t> 文本，<w:p> 视为换行
    let out = '';
    const paras = xml.split(/<\/w:p>/);
    for(const p of paras){
      const ts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const line = ts.map(t=>t.replace(/<[^>]+>/g,'')).join('');
      if(line) out += line + '\n';
    }
    return out.trim();
  }
  if(ext==='pdf'){
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data:buf}).promise;
    let out = '';
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map(it=>it.str).join(' ') + '\n';
    }
    return out.trim();
  }
  if(ext==='doc'){
    // .doc 二进制不处理，提示
    throw new Error('暂不支持 .doc 旧格式，请另存为 .docx 或 .pdf');
  }
  throw new Error('不支持的文件类型: .'+ext);
}

/* ---------- Toast / Modal ---------- */
function toast(msg, ms=2000){
  const el = document.createElement('div');
  el.className='toast'; el.textContent=msg;
  $('toasts').appendChild(el);
  setTimeout(()=>el.remove(), ms);
}
function $(sel, root=document){ return root.querySelector(sel); }
function $$(sel, root=document){ return [...root.querySelectorAll(sel)]; }

function openModal(html){
  $('modalCard').innerHTML = html;
  $('modal').hidden = false;
}
function closeModal(){ $('modal').hidden = true; }

/* ============================================================
 * 进度条 & 步骤渲染
 * ============================================================ */
const STEPS = [
  {n:1, name:'题目提取', desc:'上传作业原文件或拍照，AI 识别题目'},
  {n:2, name:'题目校对', desc:'人工检查 + AI 通顺检查，可修改'},
  {n:3, name:'答案获取', desc:'上传答案 / AI 制作答案'},
  {n:4, name:'答案对应', desc:'把答案逐条对应到题目'},
  {n:5, name:'批改留痕', desc:'上传学生作业，按名单或顺序批改'}
];

function renderStepper(){
  const s = state.step;
  $('stepChip').textContent = `第 ${s} 步 / 共 5 步（${s}/5）`;
  $('stepSub').textContent = STEPS[s-1].desc;
  const nav = $('stepper');
  nav.innerHTML = '';
  STEPS.forEach((st, i)=>{
    const idx = i+1;
    const dot = document.createElement('div');
    dot.className = 'step-dot' + (idx<s?' done':idx===s?' active':'');
    dot.innerHTML = `<span class="num">${idx<s?'✓':idx}</span><span class="lbl">${st.name}</span>`;
    nav.appendChild(dot);
    if(idx<5){
      const line = document.createElement('div');
      line.className = 'step-line' + (idx<s?' done':'');
      nav.appendChild(line);
    }
  });
  // 底部按钮
  $('prevBtn').disabled = (s===1);
  $('nextBtn').textContent = (s===5?'完成':'下一步 →');
}

function goto(n){
  if(n<1||n>5) return;
  state.step = n; save(); render();
  window.scrollTo({top:0, behavior:'smooth'});
}

function render(){
  renderStepper();
  const root = $('stepRoot');
  const s = state.step;
  if(s===1) renderStep1(root);
  else if(s===2) renderStep2(root);
  else if(s===3) renderStep3(root);
  else if(s===4) renderStep4(root);
  else if(s===5) renderStep5(root);
}

/* ============================================================
 * 第 1 步：题目提取
 * ============================================================ */
function renderStep1(root){
  root.innerHTML = `
    <div class="step-head">
      <h1>第 1 步 / 共 5 步（1/5）· 题目提取</h1>
      <p>上传 AI 作业原文件直接解析，或上传已写过作业的照片让 AI 识别题目。提取后可在下一步校对修改。</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title"><span class="dot"></span>方式一：上传作业原文件</div>
        <p class="muted">支持 .txt / .md / .docx / .pdf / .json，直接解析文字内容。</p>
        <div class="dropzone" id="dzFile">
          <div class="big">📄</div>
          <div><b>点击或拖拽文件到此处</b></div>
          <div class="hint">支持 docx / pdf / txt / md / json</div>
          <input type="file" id="fileInput" hidden accept=".txt,.md,.docx,.pdf,.json,.csv" />
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--info)"></span>方式二：上传作业照片</div>
        <p class="muted">上传一页或多页作业照片，由 AI（OCR）识别其中的题目。</p>
        <div class="dropzone" id="dzImage">
          <div class="big">🖼️</div>
          <div><b>点击或拖拽图片到此处</b></div>
          <div class="hint">支持 jpg / png / webp，可多选</div>
          <input type="file" id="imgInput" hidden accept="image/*" multiple />
        </div>
      </div>
    </div>

    <div class="card" id="qPreview" ${state.questions.length?'':'hidden'}>
      <div class="card-title"><span class="dot" style="background:var(--success)"></span>已提取题目（${state.questions.length} 道）</div>
      <div id="qList"></div>
      <div class="flex" style="margin-top:12px">
        <button class="btn btn-ghost btn-sm" id="btnClearQ">清空重来</button>
        <span class="spacer"></span>
        <button class="btn btn-primary" id="btnToStep2">下一步：题目校对 →</button>
      </div>
    </div>
  `;

  // 文件上传
  const fileInput = $('fileInput');
  $('dzFile').addEventListener('click', ()=> fileInput.click());
  $('dzFile').addEventListener('dragover', e=>{e.preventDefault(); $('dzFile').classList.add('drag');});
  $('dzFile').addEventListener('dragleave', ()=> $('dzFile').classList.remove('drag'));
  $('dzFile').addEventListener('drop', e=>{
    e.preventDefault(); $('dzFile').classList.remove('drag');
    if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); });

  // 图片上传
  const imgInput = $('imgInput');
  $('dzImage').addEventListener('click', ()=> imgInput.click());
  $('dzImage').addEventListener('dragover', e=>{e.preventDefault(); $('dzImage').classList.add('drag');});
  $('dzImage').addEventListener('dragleave', ()=> $('dzImage').classList.remove('drag'));
  $('dzImage').addEventListener('drop', e=>{
    e.preventDefault(); $('dzImage').classList.remove('drag');
    if(e.dataTransfer.files.length) handleImages([...e.dataTransfer.files]);
  });
  imgInput.addEventListener('change', e=>{ if(e.target.files.length) handleImages([...e.target.files]); });

  $('btnClearQ').addEventListener('click', ()=>{
    state.questions = []; save(); renderStep1(root);
  });
  $('btnToStep2').addEventListener('click', ()=> goto(2));

  renderQList();
}

async function handleFile(file){
  const dz = $('dzFile');
  dz.innerHTML = `<div class="big"><span class="loading"></span></div><div>正在解析 ${file.name} ...</div>`;
  try{
    const text = await parseFile(file);
    await extractQuestionsFromText(text);
  }catch(e){
    dz.innerHTML = `<div class="big">❌</div><div>解析失败：${e.message}</div><div class="hint">请换一种格式重试</div>`;
    setTimeout(()=>renderStep1($('stepRoot')), 2500);
  }
}

async function handleImages(files){
  const dz = $('dzImage');
  dz.innerHTML = `<div class="big"><span class="loading"></span></div><div>正在识别 ${files.length} 张图片 ...</div>`;
  try{
    const dataUrls = [];
    for(const f of files){
      dataUrls.push(await readAsDataURL(f));
    }
    await extractQuestionsFromImages(dataUrls);
  }catch(e){
    dz.innerHTML = `<div class="big">❌</div><div>识别失败：${e.message}</div><div class="hint">请重试或更换图片</div>`;
    setTimeout(()=>renderStep1($('stepRoot')), 2500);
  }
}

function readAsDataURL(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=> res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* 从文本提取题目 */
async function extractQuestionsFromText(text){
  openModal(`
    <div class="modal-head"><h2>AI 正在从文件中提取题目…</h2></div>
    <p class="muted">请稍候，AI 会把题目拆成数组返回。</p>
  `);
  try{
    const sys = '你是作业题目提取助手。用户会给你一段作业原文（可能是题目列表），请把每一道独立的题目提取出来，按顺序返回 JSON：{"questions":["第1题完整文字","第2题完整文字",...]}。规则：1) 每道题保留完整题干；2) 不要省略；3) 只输出 JSON，不要其他文字。';
    const user = `作业原文如下：\n\n${text.slice(0, 12000)}`;
    const raw = await aiText(sys, user, {maxTokens:3000});
    const j = extractJSON(raw);
    const qs = (j && j.questions) || [];
    if(!qs.length) throw new Error('AI 没有返回题目，请检查文件内容');
    state.questions = qs.map(t=>({id:uid(), text:String(t).trim(), aiNote:''}));
    save();
    closeModal();
    toast(`提取到 ${qs.length} 道题目`);
    renderStep1($('stepRoot'));
  }catch(e){
    closeModal();
    toast('提取失败：'+e.message, 3500);
    renderStep1($('stepRoot'));
  }
}

/* 从图片 OCR 提取题目 */
async function extractQuestionsFromImages(dataUrls){
  openModal(`
    <div class="modal-head"><h2>AI 正在识别图片中的题目…</h2></div>
    <p class="muted">请稍候，AI 会逐张识别并合并题目。</p>
  `);
  try{
    const sys = '你是作业 OCR 识别助手。用户上传的是作业页面照片，请把照片里所有题目按顺序完整识别出来，返回 JSON：{"questions":["第1题","第2题",...]}。规则：1) 完整抄录题干文字，包括数字、符号；2) 不要漏题；3) 只输出 JSON。';
    const user = '请识别图中所有题目，按顺序输出 JSON。';
    const raw = await aiVision(dataUrls, sys, user, {maxTokens:3000});
    const j = extractJSON(raw);
    const qs = (j && j.questions) || [];
    if(!qs.length) throw new Error('AI 没有识别到题目，请换清晰图片重试');
    state.questions = qs.map(t=>({id:uid(), text:String(t).trim(), aiNote:''}));
    save();
    closeModal();
    toast(`识别到 ${qs.length} 道题目`);
    renderStep1($('stepRoot'));
  }catch(e){
    closeModal();
    toast('识别失败：'+e.message, 3500);
    renderStep1($('stepRoot'));
  }
}

function renderQList(){
  const box = $('qPreview'); if(!box) return;
  box.hidden = !state.questions.length;
  const list = $('qList'); if(!list) return;
  list.innerHTML = state.questions.map((q,i)=>`
    <div class="q-item">
      <div class="idx">${i+1}</div>
      <div class="body">
        <div style="white-space:pre-wrap;font-size:13px;line-height:1.6">${escapeHtml(q.text)}</div>
      </div>
    </div>
  `).join('');
}

function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/* ============================================================
 * 第 2 步：题目校对
 * ============================================================ */
function renderStep2(root){
  if(!state.questions.length){
    root.innerHTML = emptyStep('还没有题目，请先回到第 1 步提取题目。');
    return;
  }
  root.innerHTML = `
    <div class="step-head">
      <h1>第 2 步 / 共 5 步（2/5）· 题目校对</h1>
      <p>请逐题检查是否完整通顺。可直接修改；也可让 AI 检查一遍。</p>
    </div>
    <div class="card">
      <div class="flex" style="margin-bottom:10px">
        <button class="btn btn-primary btn-sm" id="btnAiCheck">🤖 AI 检查通顺</button>
        <button class="btn btn-ghost btn-sm" id="btnAddQ">+ 新增题目</button>
        <span class="spacer"></span>
        <span class="muted">共 ${state.questions.length} 道</span>
      </div>
      <div id="qEditList"></div>
    </div>
  `;
  renderQEdit();
  $('btnAiCheck').addEventListener('click', aiCheckFluency);
  $('btnAddQ').addEventListener('click', ()=>{
    state.questions.push({id:uid(), text:'', aiNote:''});
    save(); renderQEdit();
  });
}

function renderQEdit(){
  const list = $('qEditList'); if(!list) return;
  list.innerHTML = state.questions.map((q,i)=>`
    <div class="q-item" data-id="${q.id}">
      <div class="idx">${i+1}</div>
      <div class="body">
        <textarea data-role="qtext">${escapeHtml(q.text)}</textarea>
        <div class="meta">
          ${q.aiNote?`<span class="tag ${q.aiNote.startsWith('✓')?'ok':'warn'}">${escapeHtml(q.aiNote)}</span>`:''}
        </div>
        <div class="flex" style="margin-top:6px">
          <button class="btn btn-ghost btn-sm" data-act="del">删除</button>
          <button class="btn btn-ghost btn-sm" data-act="up">↑</button>
          <button class="btn btn-ghost btn-sm" data-act="down">↓</button>
        </div>
      </div>
    </div>
  `).join('');
  // 绑定
  $$('.q-item', list).forEach(item=>{
    const id = item.dataset.id;
    const ta = $('textarea', item);
    ta.addEventListener('input', ()=>{
      const q = state.questions.find(x=>x.id===id);
      if(q){ q.text = ta.value; save(); }
    });
    $$('button', item).forEach(b=>{
      b.addEventListener('click', ()=>{
        const act = b.dataset.act;
        const idx = state.questions.findIndex(x=>x.id===id);
        if(act==='del'){ state.questions.splice(idx,1); }
        else if(act==='up' && idx>0){ [state.questions[idx-1],state.questions[idx]]=[state.questions[idx],state.questions[idx-1]]; }
        else if(act==='down' && idx<state.questions.length-1){ [state.questions[idx+1],state.questions[idx]]=[state.questions[idx],state.questions[idx+1]]; }
        save(); renderQEdit();
      });
    });
  });
}

async function aiCheckFluency(){
  $('btnAiCheck').disabled = true;
  $('btnAiCheck').innerHTML = '<span class="loading"></span> 检查中…';
  try{
    const sys = '你是语文老师，检查作业题目是否通顺、完整、没有错别字。用户给你题目数组，返回 JSON：{"notes":["第1题的批注（通顺则写 ✓，否则写出问题）","第2题批注",...]}。批注要简短，只输出 JSON。';
    const user = '题目：\n'+JSON.stringify(state.questions.map(q=>q.text));
    const raw = await aiText(sys, user, {maxTokens:2000});
    const j = extractJSON(raw);
    const notes = (j && j.notes) || [];
    state.questions.forEach((q,i)=>{ q.aiNote = notes[i] || ''; });
    save(); renderQEdit();
    toast('AI 检查完成');
  }catch(e){
    toast('检查失败：'+e.message, 3000);
  }finally{
    $('btnAiCheck').disabled = false;
    $('btnAiCheck').innerHTML = '🤖 AI 检查通顺';
  }
}

/* ============================================================
 * 第 3 步：答案获取
 * ============================================================ */
function renderStep3(root){
  if(!state.questions.length){
    root.innerHTML = emptyStep('还没有题目，请先完成第 1、2 步。');
    return;
  }
  root.innerHTML = `
    <div class="step-head">
      <h1>第 3 步 / 共 5 步（3/5）· 答案获取</h1>
      <p>上传答案文件直接提取；上传答案照片需确认是否正确；也可让 AI 自动制作答案。</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--success)"></span>上传答案文件</div>
        <p class="muted">支持 docx / pdf / txt，直接提取答案，无需确认。</p>
        <div class="dropzone" id="dzAnsFile">
          <div class="big">📄</div><div><b>点击或拖拽答案文件</b></div>
          <input type="file" id="ansFileInput" hidden accept=".txt,.md,.docx,.pdf,.json" />
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="dot" style="background:var(--info)"></span>上传答案照片</div>
        <p class="muted">AI 识别后会先询问「是否为正确答案」，确认后再使用。</p>
        <div class="dropzone" id="dzAnsImg">
          <div class="big">🖼️</div><div><b>点击或拖拽答案照片</b></div>
          <input type="file" id="ansImgInput" hidden accept="image/*" multiple />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="dot" style="background:var(--accent)"></span>AI 自动制作答案</div>
      <p class="muted">根据已校对的 ${state.questions.length} 道题目，AI 逐题生成参考答案。</p>
      <button class="btn btn-primary" id="btnAiAns">🤖 让 AI 生成全部答案</button>
    </div>

    <div class="card" id="ansCard" ${state.answers.length?'':'hidden'}>
      <div class="card-title"><span class="dot" style="background:var(--success)"></span>已获取答案（${state.answers.length} 条）</div>
      <div id="ansList"></div>
      <div class="flex" style="margin-top:12px">
        <button class="btn btn-ghost btn-sm" id="btnClearAns">清空答案</button>
        <span class="spacer"></span>
        <button class="btn btn-primary" id="btnToStep4">下一步：答案对应 →</button>
      </div>
    </div>
  `;

  const fi = $('ansFileInput');
  $('dzAnsFile').addEventListener('click', ()=> fi.click());
  fi.addEventListener('change', e=>{ if(e.target.files[0]) handleAnswerFile(e.target.files[0]); });

  const ii = $('ansImgInput');
  $('dzAnsImg').addEventListener('click', ()=> ii.click());
  ii.addEventListener('change', e=>{ if(e.target.files.length) handleAnswerImages([...e.target.files]); });

  $('btnAiAns').addEventListener('click', aiGenerateAnswers);
  $('btnClearAns').addEventListener('click', ()=>{ state.answers=[]; save(); renderStep3(root); });
  $('btnToStep4').addEventListener('click', ()=> goto(4));

  renderAnsList();
}

async function handleAnswerFile(file){
  const dz = $('dzAnsFile');
  dz.innerHTML = `<div class="big"><span class="loading"></span></div><div>正在解析答案文件…</div>`;
  try{
    const text = await parseFile(file);
    const sys = '你是答案提取助手。用户给你答案文件内容，请把每一道题的答案单独提取出来，按顺序返回 JSON：{"answers":["第1题答案","第2题答案",...]}。只输出 JSON。';
    openModal(`<div class="modal-head"><h2>AI 正在从文件提取答案…</h2></div>`);
    const raw = await aiText(sys, '答案内容：\n'+text.slice(0,12000), {maxTokens:3000});
    closeModal();
    const j = extractJSON(raw);
    const ans = (j && j.answers) || [];
    if(!ans.length) throw new Error('没有提取到答案');
    // 文件来源直接使用，confirmed=true
    ans.forEach(t=> state.answers.push({id:uid(), text:String(t).trim(), source:'file', confirmed:true}));
    save(); toast(`提取到 ${ans.length} 条答案`);
    renderStep3($('stepRoot'));
  }catch(e){
    dz.innerHTML = `<div class="big">❌</div><div>${e.message}</div>`;
    setTimeout(()=>renderStep3($('stepRoot')), 2200);
  }
}

async function handleAnswerImages(files){
  const dz = $('dzAnsImg');
  dz.innerHTML = `<div class="big"><span class="loading"></span></div><div>AI 正在识别答案照片…</div>`;
  try{
    const dataUrls = [];
    for(const f of files) dataUrls.push(await readAsDataURL(f));
    const sys = '你是答案 OCR 助手。用户上传的是答案页照片，请把每道题的答案按顺序完整识别，返回 JSON：{"answers":["第1题答案","第2题答案",...]}。只输出 JSON。';
    const raw = await aiVision(dataUrls, sys, '请识别图中所有答案，按顺序输出 JSON。', {maxTokens:3000});
    const j = extractJSON(raw);
    const ans = (j && j.answers) || [];
    if(!ans.length) throw new Error('没有识别到答案');
    closeModal();
    // 照片来源需先询问用户是否正确
    confirmAnswerPhotos(ans);
  }catch(e){
    dz.innerHTML = `<div class="big">❌</div><div>${e.message}</div>`;
    setTimeout(()=>renderStep3($('stepRoot')), 2200);
  }
}

function confirmAnswerPhotos(ans){
  openModal(`
    <div class="modal-head"><h2>这是否为正确答案？</h2></div>
    <p class="muted">AI 从照片中识别到以下 ${ans.length} 条答案，请核对：</p>
    <div id="confirmAnsList" style="max-height:340px;overflow:auto;margin-bottom:14px"></div>
    <div class="flex">
      <button class="btn btn-ghost" id="btnCancelAns">取消</button>
      <span class="spacer"></span>
      <button class="btn btn-primary" id="btnConfirmAns">✓ 确认，使用这些答案</button>
    </div>
  `);
  $('confirmAnsList').innerHTML = ans.map((t,i)=>`
    <div class="a-item" style="margin-bottom:6px">
      <div class="idx">${i+1}</div>
      <div class="body"><textarea style="min-height:44px">${escapeHtml(t)}</textarea></div>
    </div>
  `).join('');
  const tas = $$('#confirmAnsList textarea');
  $('btnCancelAns').addEventListener('click', ()=>{ closeModal(); renderStep3($('stepRoot')); });
  $('btnConfirmAns').addEventListener('click', ()=>{
    tas.forEach((ta,i)=> ans[i] = ta.value.trim());
    ans.filter(Boolean).forEach(t=> state.answers.push({id:uid(), text:t, source:'photo', confirmed:true}));
    save(); closeModal(); toast(`已添加 ${ans.filter(Boolean).length} 条答案`);
    renderStep3($('stepRoot'));
  });
}

async function aiGenerateAnswers(){
  $('btnAiAns').disabled = true;
  $('btnAiAns').innerHTML = '<span class="loading"></span> 生成中…';
  openModal(`<div class="modal-head"><h2>AI 正在为 ${state.questions.length} 道题生成答案…</h2></div><p class="muted">请稍候。</p>`);
  try{
    const sys = '你是学科老师。用户给你题目数组，请为每道题给出简洁、准确的参考答案，按顺序返回 JSON：{"answers":["第1题答案","第2题答案",...]}。只输出 JSON。';
    const user = '题目：\n'+JSON.stringify(state.questions.map((q,i)=>(`${i+1}. ${q.text}`)));
    const raw = await aiText(sys, user, {maxTokens:3000});
    const j = extractJSON(raw);
    const ans = (j && j.answers) || [];
    closeModal();
    if(!ans.length){ toast('AI 没有返回答案'); return; }
    ans.forEach(t=> state.answers.push({id:uid(), text:String(t).trim(), source:'ai', confirmed:true}));
    save(); toast(`生成 ${ans.length} 条答案`);
    renderStep3($('stepRoot'));
  }catch(e){
    closeModal(); toast('生成失败：'+e.message, 3000);
  }finally{
    $('btnAiAns').disabled = false;
    $('btnAiAns').innerHTML = '🤖 让 AI 生成全部答案';
  }
}

function renderAnsList(){
  const card = $('ansCard'); if(!card) return;
  card.hidden = !state.answers.length;
  const list = $('ansList'); if(!list) return;
  list.innerHTML = state.answers.map((a,i)=>`
    <div class="a-item" data-id="${a.id}">
      <div class="idx">${i+1}</div>
      <div class="body">
        <textarea data-role="anstext">${escapeHtml(a.text)}</textarea>
        <div class="meta">
          来源：<span class="tag ${a.source==='ai'?'':a.source==='photo'?'warn':'ok'}">${a.source==='ai'?'AI生成':a.source==='photo'?'照片':'文件'}</span>
          ${a.confirmed?'<span class="tag ok">已确认</span>':''}
          <button class="btn btn-ghost btn-sm" data-act="del" style="float:right">删除</button>
        </div>
      </div>
    </div>
  `).join('');
  $$('.a-item', list).forEach(item=>{
    const id = item.dataset.id;
    $('textarea', item).addEventListener('input', e=>{
      const a = state.answers.find(x=>x.id===id);
      if(a){ a.text = e.target.value; save(); }
    });
    $('[data-act=del]', item).addEventListener('click', ()=>{
      state.answers = state.answers.filter(x=>x.id!==id);
      save(); renderAnsList();
    });
  });
}

/* ============================================================
 * 第 4 步：答案对应题目
 * ============================================================ */
function renderStep4(root){
  if(!state.questions.length){
    root.innerHTML = emptyStep('还没有题目。');
    return;
  }
  if(!state.answers.length){
    root.innerHTML = emptyStep('还没有答案，请先回到第 3 步获取答案。');
    return;
  }
  // 初始化 mapping
  if(state.mapping.length !== state.questions.length){
    state.mapping = state.questions.map((q,i)=>({
      qid: q.id,
      aid: state.answers[i] ? state.answers[i].id : ''
    }));
    save();
  }
  root.innerHTML = `
    <div class="step-head">
      <h1>第 4 步 / 共 5 步（4/5）· 答案对应题目</h1>
      <p>AI 会先自动对应，你可手动调整每道题对应的答案。</p>
    </div>
    <div class="card">
      <div class="flex" style="margin-bottom:10px">
        <button class="btn btn-primary btn-sm" id="btnAiMap">🤖 AI 自动对应</button>
        <button class="btn btn-ghost btn-sm" id="btnAutoSeq">按顺序对应</button>
        <span class="spacer"></span>
        <span class="muted">${state.questions.length} 题 · ${state.answers.length} 答案</span>
      </div>
      <div id="mapList"></div>
    </div>
  `;
  renderMapList();
  $('btnAiMap').addEventListener('click', aiMapAnswers);
  $('btnAutoSeq').addEventListener('click', ()=>{
    state.mapping = state.questions.map((q,i)=>({qid:q.id, aid: state.answers[i]?state.answers[i].id:''}));
    save(); renderMapList(); toast('已按顺序对应');
  });
}

function renderMapList(){
  const list = $('mapList'); if(!list) return;
  const options = '<option value="">— 未对应 —</option>' +
    state.answers.map((a,i)=>`<option value="${a.id}">答案 ${i+1}: ${escapeHtml(a.text.slice(0,30))}${a.text.length>30?'…':''}</option>`).join('');
  list.innerHTML = state.mapping.map((m,i)=>{
    const q = state.questions[i];
    return `
      <div class="map-row">
        <div class="idx">${i+1}</div>
        <div style="font-size:12px;line-height:1.5">${escapeHtml((q?.text||'').slice(0,80))}</div>
        <select data-qid="${m.qid}">${options.replace(`value="${m.aid}"`, `value="${m.aid}" selected`)}</select>
        <div><button class="btn btn-ghost btn-sm" data-act="clear">清除</button></div>
      </div>
    `;
  }).join('');
  $$('select', list).forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const m = state.mapping.find(x=>x.qid===sel.dataset.qid);
      if(m){ m.aid = sel.value; save(); }
    });
  });
  $$('[data-act=clear]', list).forEach(b=>{
    b.addEventListener('click', ()=>{
      const row = b.closest('.map-row');
      const sel = $('select', row);
      sel.value = '';
      sel.dispatchEvent(new Event('change'));
    });
  });
}

async function aiMapAnswers(){
  $('btnAiMap').disabled = true;
  $('btnAiMap').innerHTML = '<span class="loading"></span> 对应中…';
  try{
    const sys = '你是试卷整理助手。给你题目数组和答案数组，请把答案对应到题目，返回 JSON：{"mapping":[[题序号,答案序号],...]}（序号从 1 开始，没有对应则填 0）。只输出 JSON。';
    const user = `题目：\n${JSON.stringify(state.questions.map(q=>q.text))}\n\n答案：\n${JSON.stringify(state.answers.map(a=>a.text))}`;
    const raw = await aiText(sys, user, {maxTokens:2000});
    const j = extractJSON(raw);
    const pairs = (j && j.mapping) || [];
    pairs.forEach(([qi, ai])=>{
      const m = state.mapping[qi-1];
      if(m && ai>0 && state.answers[ai-1]) m.aid = state.answers[ai-1].id;
    });
    save(); renderMapList();
    toast('AI 对应完成');
  }catch(e){
    toast('对应失败：'+e.message, 3000);
  }finally{
    $('btnAiMap').disabled = false;
    $('btnAiMap').innerHTML = '🤖 AI 自动对应';
  }
}

/* ============================================================
 * 第 5 步：批改留痕
 * ============================================================ */
let currentSub = null;   // 当前正在批改的 submission
let markMode = 'check';  // 'check' | 'cross'
let activeQid = null;    // 当前选中的题目 id

function renderStep5(root){
  if(!state.questions.length || !state.answers.length){
    root.innerHTML = emptyStep('请先完成前面的步骤（题目 + 答案）。');
    return;
  }
  root.innerHTML = `
    <div class="step-head">
      <h1>第 5 步 / 共 5 步（5/5）· 批改学生作业</h1>
      <p>上传学生作业照片，在照片上用 ✅ / ❌ 标注对错，结果保留在照片上。</p>
    </div>

    <div class="card">
      <div class="card-title"><span class="dot"></span>批改模式</div>
      <div class="flex">
        <label class="btn ${state.mode==='roster'?'btn-primary':''}" style="cursor:pointer">
          <input type="radio" name="mode" value="roster" ${state.mode==='roster'?'checked':''} hidden>
          📋 按名单顺序
        </label>
        <label class="btn ${state.mode==='plain'?'btn-primary':''}" style="cursor:pointer">
          <input type="radio" name="mode" value="plain" ${state.mode==='plain'?'checked':''} hidden>
          📷 无名单顺序
        </label>
      </div>
    </div>

    <div class="card" id="rosterCard" ${state.mode==='roster'?'':'hidden'}>
      <div class="card-title"><span class="dot" style="background:var(--info)"></span>学生名单</div>
      <div class="flex" style="margin-bottom:10px">
        <input class="input" id="newClassName" placeholder="班级名称" style="max-width:160px">
        <input class="input" id="newSubject" placeholder="学科（可选）" style="max-width:140px">
        <button class="btn btn-primary btn-sm" id="btnAddClass">+ 添加班级</button>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" id="btnImportRoster">📥 导入名单（文本）</button>
      </div>
      <div id="rosterList"></div>
    </div>

    <div class="card">
      <div class="card-title"><span class="dot" style="background:var(--success)"></span>学生作业</div>
      <div class="flex" style="margin-bottom:10px">
        <button class="btn btn-primary btn-sm" id="btnAddSub">+ 添加学生</button>
        <span class="spacer"></span>
        <span class="muted">共 ${state.submissions.length} 份</span>
      </div>
      <div id="subList"></div>
    </div>

    <div class="card" id="gradeCard" hidden>
      <div class="card-title"><span class="dot" style="background:var(--accent)"></span>批改：<span id="gradeStudentName"></span></div>
      <div class="grade-wrap">
        <div>
          <div class="toolbar">
            <button class="btn btn-sm" id="btnAddPhoto">📷 上传/拍照</button>
            <input type="file" id="subPhotoInput" hidden accept="image/*" multiple>
            <button class="btn btn-sm" id="btnMarkCheck">✅ 对</button>
            <button class="btn btn-sm" id="btnMarkCross">❌ 错</button>
            <button class="btn btn-sm btn-ghost" id="btnErase">🧹 擦除</button>
            <button class="btn btn-sm btn-ghost" id="btnExportImg">💾 保存批改图</button>
            <span class="spacer"></span>
            <button class="btn btn-success btn-sm" id="btnFinishGrade">完成批改</button>
          </div>
          <div class="canvas-box" id="canvasBox">
            <div class="empty">请先上传学生作业照片</div>
          </div>
          <div class="muted" style="margin-top:6px">先点右侧题目，再在照片上点击位置盖 ✅/❌。也可直接在照片上点击，弹窗选择对错。</div>
        </div>
        <div>
          <div class="card-title">题目列表</div>
          <div id="gradeQList"></div>
        </div>
      </div>
    </div>
  `;

  // 模式
  $$('input[name=mode]').forEach(r=> r.addEventListener('change', ()=>{
    state.mode = r.value; save(); renderStep5(root);
  }));

  $('btnAddClass').addEventListener('click', ()=>{
    const c = $('newClassName').value.trim();
    if(!c) return toast('请输入班级名称');
    state.roster.push({class:c, subject:$('newSubject').value.trim(), students:[]});
    save(); renderRoster();
    $('newClassName').value=''; $('newSubject').value='';
  });
  $('btnImportRoster').addEventListener('click', importRoster);
  $('btnAddSub').addEventListener('click', addSubmission);
  renderRoster();
  renderSubList();

  // 批改
  $('btnAddPhoto').addEventListener('click', ()=> openPhotoPicker());
  $('subPhotoInput').addEventListener('change', e=>{ if(e.target.files.length) addSubPhotos([...e.target.files]); });
  $('btnMarkCheck').addEventListener('click', ()=>{ markMode='check'; updateMarkBtns(); });
  $('btnMarkCross').addEventListener('click', ()=>{ markMode='cross'; updateMarkBtns(); });
  $('btnErase').addEventListener('click', ()=>{ markMode='erase'; updateMarkBtns(); });
  $('btnExportImg').addEventListener('click', exportGradeImage);
  $('btnFinishGrade').addEventListener('click', ()=>{
    if(currentSub){ currentSub.done = true; save(); closeGrade(); toast('批改完成'); }
  });
}

/* ---- 名单 ---- */
function renderRoster(){
  const box = $('rosterList'); if(!box) return;
  box.innerHTML = state.roster.map((c,ci)=>`
    <div class="class-card">
      <div class="class-head">
        <b>${escapeHtml(c.class)}</b>
        ${c.subject?`<span class="tag">${escapeHtml(c.subject)}</span>`:''}
        <span class="spacer"></span>
        <input class="input" id="newStu_${ci}" placeholder="学生姓名" style="max-width:140px;padding:5px 10px;font-size:12px">
        <button class="btn btn-primary btn-sm" data-ci="${ci}" data-act="addStu">+ 添加</button>
        <button class="btn btn-ghost btn-sm" data-ci="${ci}" data-act="delClass">删除班级</button>
      </div>
      <div class="stu-list">
        ${c.students.map((s,si)=>`
          <div class="stu-row">
            <span style="color:var(--muted);font-size:12px;width:24px">${si+1}</span>
            <span class="name">${escapeHtml(s.name)}</span>
            <button class="btn btn-ghost btn-sm" data-ci="${ci}" data-si="${si}" data-act="delStu">删除</button>
          </div>
        `).join('') || '<div class="empty" style="padding:12px">暂无学生</div>'}
      </div>
    </div>
  `).join('');
  $$('[data-act=addStu]', box).forEach(b=> b.addEventListener('click', ()=>{
    const ci = +b.dataset.ci;
    const name = $(`#newStu_${ci}`).value.trim();
    if(!name) return;
    state.roster[ci].students.push({id:uid(), name});
    save(); renderRoster();
  }));
  $$('[data-act=delStu]', box).forEach(b=> b.addEventListener('click', ()=>{
    const ci=+b.dataset.ci, si=+b.dataset.si;
    state.roster[ci].students.splice(si,1); save(); renderRoster();
  }));
  $$('[data-act=delClass]', box).forEach(b=> b.addEventListener('click', ()=>{
    state.roster.splice(+b.dataset.ci,1); save(); renderRoster();
  }));
}

function importRoster(){
  openModal(`
    <div class="modal-head"><h2>导入学生名单</h2></div>
    <p class="muted">每行一个学生姓名；也支持「班级：姓名」格式自动创建班级。</p>
    <textarea id="importText" rows="10" placeholder="张三&#10;李四&#10;王五"></textarea>
    <div class="flex" style="margin-top:10px">
      <button class="btn btn-ghost" id="btnCancelImport">取消</button>
      <span class="spacer"></span>
      <button class="btn btn-primary" id="btnDoImport">导入</button>
    </div>
  `);
  $('btnCancelImport').addEventListener('click', closeModal);
  $('btnDoImport').addEventListener('click', ()=>{
    const lines = $('importText').value.split('\n').map(l=>l.trim()).filter(Boolean);
    let lastClass = null;
    lines.forEach(line=>{
      const m = line.match(/^(.+?)[：:]\s*(.+)$/);
      if(m){
        const cname = m[1].trim();
        let cls = state.roster.find(c=>c.class===cname);
        if(!cls){ cls={class:cname, subject:'', students:[]}; state.roster.push(cls); }
        lastClass = cls;
        cls.students.push({id:uid(), name:m[2].trim()});
      }else if(lastClass){
        lastClass.students.push({id:uid(), name:line});
      }else{
        let cls = state.roster[0];
        if(!cls){ cls={class:'默认班级', subject:'', students:[]}; state.roster.push(cls); }
        cls.students.push({id:uid(), name:line});
      }
    });
    save(); closeModal(); renderRoster(); toast(`导入 ${lines.length} 名学生`);
  });
}

/* ---- 学生提交 ---- */
function renderSubList(){
  const box = $('subList'); if(!box) return;
  box.innerHTML = state.submissions.map((s,i)=>`
    <div class="r-item">
      <div class="idx">${i+1}</div>
      <div class="body" style="flex:1">
        <b>${escapeHtml(s.studentName||('学生 '+(i+1)))}</b>
        <div class="meta">
          ${s.photos.length} 张照片 ·
          ${s.marks.filter(m=>m.correct).length} ✅ /
          ${s.marks.filter(m=>!m.correct).length} ❌
          ${s.done?'<span class="tag ok">已批改</span>':'<span class="tag">待批改</span>'}
        </div>
      </div>
      <div class="flex">
        <button class="btn btn-primary btn-sm" data-sid="${s.id}" data-act="grade">批改</button>
        <button class="btn btn-ghost btn-sm" data-sid="${s.id}" data-act="del">删除</button>
      </div>
    </div>
  `).join('') || '<div class="empty">还没有学生作业，点击上方「+ 添加学生」</div>';
  $$('[data-act=grade]', box).forEach(b=> b.addEventListener('click', ()=> openGrade(b.dataset.sid)));
  $$('[data-act=del]', box).forEach(b=> b.addEventListener('click', ()=>{
    state.submissions = state.submissions.filter(s=>s.id!==b.dataset.sid);
    save(); renderSubList();
  }));
}

function addSubmission(){
  let name = '';
  if(state.mode==='roster'){
    const allStu = state.roster.flatMap(c=>c.students);
    if(!allStu.length){ toast('请先添加学生名单'); return; }
    // 取下一个未批改的学生
    const doneNames = new Set(state.submissions.map(s=>s.studentName));
    const next = allStu.find(s=>!doneNames.has(s.name)) || allStu[state.submissions.length % allStu.length];
    name = next.name;
  }else{
    name = '学生 ' + (state.submissions.length+1);
  }
  const sub = {id:uid(), studentId:null, studentName:name, photos:[], marks:[], done:false};
  state.submissions.push(sub);
  save(); renderSubList();
  openGrade(sub.id);
}

/* ---- 批改界面 ---- */
function openGrade(sid){
  currentSub = state.submissions.find(s=>s.id===sid);
  if(!currentSub) return;
  activeQid = state.questions[0]?.id || null;
  $('gradeCard').hidden = false;
  $('gradeStudentName').textContent = currentSub.studentName;
  renderGradeQList();
  renderCanvas();
  updateMarkBtns();
  $('gradeCard').scrollIntoView({behavior:'smooth'});
}
function closeGrade(){
  $('gradeCard').hidden = true;
  currentSub = null;
  renderSubList();
}

function renderGradeQList(){
  const box = $('gradeQList'); if(!box) return;
  box.innerHTML = state.questions.map((q,i)=>{
    const ans = getAnswerFor(q.id);
    const marks = currentSub.marks.filter(m=>m.qid===q.id);
    const correctCount = marks.filter(m=>m.correct).length;
    const wrongCount = marks.filter(m=>!m.correct).length;
    return `
      <div class="q-item ${activeQid===q.id?'q-active':''}" data-qid="${q.id}" style="cursor:pointer;${activeQid===q.id?'border-color:var(--primary);box-shadow:0 0 0 2px var(--ring)':''}">
        <div class="idx">${i+1}</div>
        <div class="body">
          <div style="font-size:12px;line-height:1.5">${escapeHtml(q.text.slice(0,60))}</div>
          <div class="meta">答案：${escapeHtml((ans?.text||'未对应').slice(0,40))}</div>
          <div class="meta">${correctCount} ✅ · ${wrongCount} ❌</div>
        </div>
      </div>
    `;
  }).join('');
  $$('.q-item', box).forEach(el=> el.addEventListener('click', ()=>{
    activeQid = el.dataset.qid; renderGradeQList();
  }));
}
function getAnswerFor(qid){
  const m = state.mapping.find(x=>x.qid===qid);
  if(!m) return null;
  return state.answers.find(a=>a.id===m.aid) || null;
}

function updateMarkBtns(){
  $('btnMarkCheck').className = 'btn btn-sm' + (markMode==='check'?' btn-success':'');
  $('btnMarkCross').className = 'btn btn-sm' + (markMode==='cross'?' btn-danger':'');
  $('btnErase').className = 'btn btn-sm btn-ghost' + (markMode==='erase'?' active':'');
}

/* 画布渲染（照片 + 标记） */
function renderCanvas(){
  const box = $('canvasBox'); if(!box) return;
  if(!currentSub.photos.length){
    box.innerHTML = '<div class="empty">请先上传学生作业照片</div>';
    return;
  }
  box.innerHTML = '';
  currentSub.photos.forEach((src, idx)=>{
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;margin:6px;';
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.cssText = 'max-width:100%;height:auto;border-radius:10px;background:#fff;cursor:crosshair;';
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // 画已存标记
      drawMarks(ctx, idx);
      canvas.addEventListener('click', e=> handleCanvasClick(e, canvas, ctx, idx));
      wrap.appendChild(canvas);
      box.appendChild(wrap);
    };
    img.src = src;
  });
}

function drawMarks(ctx, photoIdx){
  const marks = currentSub.marks.filter(m=>m.photoIdx===photoIdx);
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  marks.forEach(m=>{
    ctx.fillText(m.correct?'✅':'❌', m.x, m.y);
  });
}

function handleCanvasClick(e, canvas, ctx, photoIdx){
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  if(markMode==='erase'){
    // 删除最近的标记
    const marks = currentSub.marks.filter(m=>m.photoIdx===photoIdx);
    for(let i=marks.length-1;i>=0;i--){
      const m = marks[i];
      if(Math.abs(m.x-x)<40 && Math.abs(m.y-y)<40){
        currentSub.marks = currentSub.marks.filter(x=>x!==m);
        save(); redrawPhoto(canvas, photoIdx);
        renderGradeQList();
        return;
      }
    }
    return;
  }
  if(!activeQid){ toast('请先选择题目'); return; }
  const correct = markMode==='check';
  currentSub.marks.push({qid:activeQid, correct, x, y, photoIdx});
  save();
  redrawPhoto(canvas, photoIdx);
  renderGradeQList();
}

function redrawPhoto(canvas, photoIdx){
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = ()=>{
    ctx.drawImage(img,0,0);
    drawMarks(ctx, photoIdx);
  };
  img.src = currentSub.photos[photoIdx];
}

/* 上传 / 拍照 */
function openPhotoPicker(){
  openModal(`
    <div class="modal-head"><h2>添加作业照片</h2></div>
    <div class="flex" style="gap:10px">
      <button class="btn btn-primary" id="btnFromFile">📁 从相册/文件选择</button>
      <button class="btn btn-primary" id="btnFromCam">📷 连续拍照</button>
    </div>
    <p class="muted" style="margin-top:10px">支持多选；拍照模式可连续拍摄不退出。</p>
    <div class="flex" style="margin-top:10px">
      <button class="btn btn-ghost" id="btnCancelPicker">取消</button>
    </div>
  `);
  $('btnFromFile').addEventListener('click', ()=>{ closeModal(); $('subPhotoInput').click(); });
  $('btnFromCam').addEventListener('click', ()=>{ closeModal(); openCamera(); });
  $('btnCancelPicker').addEventListener('click', closeModal);
}

async function addSubPhotos(files){
  for(const f of files){
    currentSub.photos.push(await readAsDataURL(f));
  }
  save(); renderCanvas();
  toast(`已添加 ${files.length} 张照片`);
}

/* 连续拍照 */
let camStream = null;
let camFacing = 'environment';
function openCamera(){
  const ov = $('camOverlay');
  ov.hidden = false;
  $('camCount').textContent = currentSub.photos.length;
  $('camShots').innerHTML = '';
  startCam();
}
async function startCam(){
  try{
    if(camStream){ camStream.getTracks().forEach(t=>t.stop()); }
    camStream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode: camFacing }, audio:false
    });
    $('camVideo').srcObject = camStream;
  }catch(e){
    toast('无法访问摄像头：'+e.message, 3000);
    closeCamera();
  }
}
function closeCamera(){
  if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null; }
  $('camOverlay').hidden = true;
}
function capturePhoto(){
  const v = $('camVideo'), c = $('camCanvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v,0,0);
  const dataUrl = c.toDataURL('image/jpeg', 0.92);
  currentSub.photos.push(dataUrl);
  save();
  $('camCount').textContent = currentSub.photos.length;
  // 缩略图
  const thumb = document.createElement('div');
  thumb.style.cssText='position:relative;display:inline-block';
  const im = document.createElement('img');
  im.src = dataUrl; im.className='cam-shot';
  const x = document.createElement('span');
  x.className='x'; x.textContent='×';
  x.addEventListener('click', ()=>{
    const idx = currentSub.photos.indexOf(dataUrl);
    if(idx>=0){ currentSub.photos.splice(idx,1); save(); $('camCount').textContent=currentSub.photos.length; thumb.remove(); }
  });
  thumb.appendChild(im); thumb.appendChild(x);
  $('camShots').appendChild(thumb);
}

/* 导出批改图 */
function exportGradeImage(){
  if(!currentSub || !currentSub.photos.length){ toast('没有照片可导出'); return; }
  currentSub.photos.forEach((src, idx)=>{
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = ()=>{
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      drawMarks(ctx, idx);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${currentSub.studentName}_批改_${idx+1}.png`;
      a.click();
    };
    img.src = src;
  });
  toast('正在下载批改图…');
}

/* ============================================================
 * 工具 & 启动
 * ============================================================ */
function emptyStep(msg){
  return `<div class="card"><div class="empty">${escapeHtml(msg)}</div></div>`;
}

/* 底部按钮 */
$('prevBtn').addEventListener('click', ()=> goto(state.step-1));
$('nextBtn').addEventListener('click', ()=>{
  if(state.step===5){
    toast('批改流程已完成！可在上方「学生作业」中查看与导出。', 3000);
    return;
  }
  goto(state.step+1);
});

/* 拍照层事件 */
$('camShoot').addEventListener('click', capturePhoto);
$('camClose').addEventListener('click', ()=>{ closeCamera(); renderCanvas(); });
$('camDone').addEventListener('click', ()=>{ closeCamera(); renderCanvas(); toast('已添加照片'); });
$('camSwitch').addEventListener('click', ()=>{
  camFacing = camFacing==='environment'?'user':'environment';
  startCam();
});
$('camOverlay').addEventListener('click', e=>{ if(e.target.id==='camOverlay') closeCamera(); });

/* 模态点击关闭 */
$('modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });

/* 启动 */
render();
