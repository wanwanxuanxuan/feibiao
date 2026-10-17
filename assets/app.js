/* 页面版本号 */
/* 重要：每次修改 app.js 或 style.css 后，必须同步提升各 HTML 中引用的 ?v= 版本号。
   GitHub Pages 对静态资源返回 cache-control: max-age=14400（4 小时），
   不加版本号会导致用户浏览器长时间继续运行旧脚本。 */
const APP_VERSION='5';

/* ============ 同步状态指示 ============ */
function setSyncStatus(state){
  const dot=document.getElementById('syncDot');
  if(!dot)return;
  dot.classList.remove('syncing');
  dot.style.background='';
  dot.style.boxShadow='';
  if(state==='online'){dot.style.background='var(--success)';dot.style.boxShadow='0 0 0 2px rgba(16,185,129,.3)';dot.title='已同步到 GitHub 仓库'}
  else if(state==='syncing'){dot.classList.add('syncing');dot.title='正在同步...'}
  else if(state==='offline'){dot.style.background='var(--danger)';dot.style.boxShadow='0 0 0 2px rgba(239,68,68,.3)';dot.title='同步失败 · 已回退本地模式'}
  else{dot.style.background='var(--muted)';dot.title='未开启同步 · 仅本地存储'}
}

/* ============ GitHub 仓库文件同步（配置项） ============ */
// 数据保存在仓库中的一个 JSON 文件里，所有设备通过 GitHub Contents API 读写同一文件实现同步
const GH_CFG_KEY='zhixueyun_ghcfg';
const GH_TOKEN_KEY='zhixueyun_ghtoken';
const GH_DEV_KEY='zhixueyun_device';
const GH_DEFAULTS={owner:'wanwanxuanxuan',repo:'feibiao',branch:'main',path:'data.json'};
let ghSync=null; // 在 Store 定义之后初始化
const DEVICE_ID=(()=>{
  let d=DBraw(GH_DEV_KEY,null);
  if(!d){d='dev_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);DBraw(GH_DEV_KEY,d)}
  return d;
})();
function DBraw(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function DBrawSet(k,v){localStorage.setItem(k,JSON.stringify(v))}

/* ============ Data Layer ============ */
const DB = {
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))},
  key:'studyhub_v1',
  roleKey:'studyhub_role'
};
const DEFAULT_STORE = {
  tasks:[], schedule:[], grades:[], notes:[], countdowns:[], pomoLog:[], theme:'light',
  homework:[], notices:[], students:[], teacherPwd:null, parentPwd:null, _meta:null
};
let store = {...DEFAULT_STORE, ...DB.get(DB.key, {})};
// 确保所有字段存在
Object.keys(DEFAULT_STORE).forEach(k=>{if(store[k]===undefined)store[k]=DEFAULT_STORE[k]});

function save(){
  store._meta={updatedAt:Date.now(),device:DEVICE_ID};
  DB.set(DB.key, store);
  broadcastSync();              // 同浏览器多标签同步
  if(ghSync)ghSync.schedulePush(); // 跨设备同步（GitHub 仓库文件）
}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmtDate=(s)=>{if(!s)return '';const d=new Date(s);return `${d.getMonth()+1}月${d.getDate()}日`};
const fmtDateTime=(s)=>{const d=new Date(s);return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2000)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* ============ Role & Auth ============ */
/* 每个页面固定一个端：由各 HTML 通过 window.__PAGE_ROLE 指定 */
const PAGE_ROLE=(window.__PAGE_ROLE||'student');
let currentRole = PAGE_ROLE;
DB.set(DB.roleKey, PAGE_ROLE);
const ROLE_META = {
  teacher:{name:'老师',icon:'👨‍🏫',greet:'老师'},
  student:{name:'学生',icon:'🧑‍🎓',greet:'同学'},
  parent:{name:'家长',icon:'👨‍👩‍👧',greet:'家长'}
};
/* 老师端 / 家长端进入时均需密码；初始密码 123456，可自行修改 */
const DEF_PWD='123456';
const PROTECTED_ROLES=['teacher','parent'];
const auth={
  protected(r){return PROTECTED_ROLES.indexOf(r)>=0},
  pwd(r){return store[r+'Pwd']},
  has(r){const p=this.pwd(r);return !!(p&&p.hash)},
  isDefault(r){const p=this.pwd(r);return !!(p&&p.hash==='default')},
  async hash(p){
    const s='zhixueyun::'+p;
    try{
      if(window.crypto&&crypto.subtle){
        const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
        return 'sha256:'+Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
      }
    }catch(e){}
    let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;
    return 'djb2:'+h.toString(16);
  },
  async verify(r,p){
    const P=this.pwd(r);if(!P||!P.hash)return false;
    if(P.hash==='default')return p===DEF_PWD;      // 初始密码直接比对
    return (await this.hash(p))===P.hash;
  },
  async setPwd(r,p){store[r+'Pwd']={hash:await this.hash(p),at:Date.now()};save()},
  resetPwd(r){store[r+'Pwd']={hash:'default',at:Date.now()};save()},   // 还原为初始密码
  unlocked(r){return sessionStorage.getItem('zhixueyun_unlock_'+r)==='1'},
  unlock(r){sessionStorage.setItem('zhixueyun_unlock_'+r,'1')},
  /* 全屏密码锁定层 */
  lockShow(r){
    auth._lockRole=r;
    const m=ROLE_META[r];
    document.getElementById('lockTitle').textContent=m.name+'端已加密';
    document.getElementById('lockTip').textContent='请输入'+m.name+'端密码以继续（初始密码 '+DEF_PWD+'）';
    document.getElementById('lockBtn').textContent='解锁';
    const p2=document.getElementById('lockPwd2');p2.style.display='none';p2.value='';
    document.getElementById('lockPwd').value='';
    document.getElementById('lockErr').textContent='';
    document.getElementById('lockMask').classList.add('show');
    setTimeout(()=>document.getElementById('lockPwd').focus(),100);
  },
  async lockSubmit(){
    const r=auth._lockRole||'teacher';
    const v=document.getElementById('lockPwd').value||'';
    const err=document.getElementById('lockErr');
    if(await auth.verify(r,v)){
      auth.unlock(r);
      document.getElementById('lockMask').classList.remove('show');
      toast('欢迎回来，'+ROLE_META[r].name);
      const f=auth._afterUnlock;auth._afterUnlock=null;
      if(typeof f==='function')f();
    }else{err.textContent='密码不正确，请重试';document.getElementById('lockPwd').value=''}
  },
  lockExit(){
    document.getElementById('lockMask').classList.remove('show');
    auth._afterUnlock=null;
    gotoRole('student');
  }
};
/* 返回 true 表示本次弹出了锁定层（需要解锁后才继续） */
function checkLock(){
  if(!auth.protected(currentRole))return false;
  if(auth.unlocked(currentRole))return false;
  auth._afterUnlock=null;
  auth.lockShow(currentRole);
  return true;
}

/* ============ 身份：学生登记姓名 / 家长选择学生 ============ */
const NAME_KEY={student:'zhixueyun_student_name',parent:'zhixueyun_parent_name'};
const persona={
  get(r){return DBraw(NAME_KEY[r]||'','')},
  set(r,v){v=String(v==null?'':v).trim();if(v)DBrawSet(NAME_KEY[r],v);else localStorage.removeItem(NAME_KEY[r])},
  /* 问候语里显示的身份："张小明同学" / "张小明 的家长" */
  label(){
    if(currentRole==='student'){const n=this.get('student');return n?n+'同学':ROLE_META.student.greet}
    if(currentRole==='parent'){const n=this.get('parent');return n?n+' 的家长':ROLE_META.parent.greet}
    return ROLE_META.teacher.greet;
  },
  studentGate(){if(currentRole==='student'&&!this.get('student'))this.openStudentModal()},
  parentGate(){if(currentRole==='parent'&&!this.get('parent'))this.openParentModal()},
  /* 学生首次进入：必须填写姓名才能继续 */
  openStudentModal(){
    const cur=this.get('student');
    openModal('填写你的姓名',`
      <div style="font-size:13px;line-height:1.7;margin-bottom:12px">首次进入学生端，请填写你的姓名。之后家长端可从学生名单中选择你。</div>
      <label class="lbl">你的姓名</label>
      <input class="input" id="personaName" maxlength="12" autocomplete="off" placeholder="例如：张小明" value="${esc(cur)}">
      <div style="font-size:11px;color:var(--muted);margin-top:6px">姓名保存在本设备，并会加入学生名单（随同步数据共享）供家长端选择。</div>`,
      `<button class="btn btn-primary" onclick="persona.saveStudent()">进入</button>`,true);
    setTimeout(()=>{const el=document.getElementById('personaName');if(el)el.focus()},120);
  },
  saveStudent(){
    const el=document.getElementById('personaName');
    const v=(el?el.value:'').trim();
    if(!v){toast('请填写姓名');return}
    this.set('student',v);
    if(!(store.students||[]).includes(v)){store.students=(store.students||[]).concat(v);save()}
    closeModal(true);updateGreeting();
    toast('欢迎，'+v+'同学');
  },
  /* 家长进入：必须选择（或填写）孩子姓名才能继续 */
  openParentModal(){
    const list=(store.students||[]).slice();
    this._list=list;                     // 渲染时的名单快照，供 pick() 按下标取用
    const cur=this.get('parent');
    const pick=list.length
      ? `<label class="lbl">学生名单（共 ${list.length} 人，点击选择）</label>
         <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:190px;overflow:auto">
           ${list.map((n,i)=>`<button class="btn ${n===cur?'btn-primary':'btn-ghost'} btn-sm" onclick="persona.pick(${i})">${esc(n)}</button>`).join('')}
         </div>`
      : `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">学生名单暂时是空的 —— 学生首次进入学生端会自动登记姓名；也可以先在下面手动填写。</div>`;
    openModal('选择你孩子的姓名',`
      <div style="font-size:13px;line-height:1.7;margin-bottom:12px">家长端需要先选定你的孩子（学生），确认后即可进入。</div>
      ${pick}
      <label class="lbl" style="margin-top:12px">或手动填写学生姓名</label>
      <input class="input" id="personaName" maxlength="12" autocomplete="off" placeholder="例如：张小明" value="${esc(cur)}">`,
      `<button class="btn btn-ghost" onclick="persona.openParentModal()">刷新名单</button>
       <button class="btn btn-primary" onclick="persona.saveParent()">确认进入</button>`,true);
    setTimeout(()=>{const el=document.getElementById('personaName');if(el)el.focus()},120);
  },
  /* 点选名单中的第 i 个学生（按下标 + 渲染时快照，避免把姓名拼进内联事件里出错） */
  pick(i){
    const n=(this._list||[])[i];
    if(!n){toast('名单已更新，请点「刷新名单」');return}
    this.saveParent(n);
  },
  saveParent(name){
    let v=name;
    if(v===undefined){const el=document.getElementById('personaName');v=(el?el.value:'')||''}
    v=String(v||'').trim();
    if(!v){toast('请选择或填写学生姓名');return}
    this.set('parent',v);
    closeModal(true);updateGreeting();
    toast('已进入：'+v+' 的家长');
  },
  /* 设置里修改身份 */
  change(){
    if(currentRole==='parent')this.openParentModal();
    else if(currentRole==='student')this.openStudentModal();
  }
};
/* 端切换：各端独立页面 */
const ROLE_PAGE={teacher:'teacher.html',student:'student.html',parent:'parent.html'};
function gotoRole(r){DB.set(DB.roleKey,r);location.href=ROLE_PAGE[r]||'student.html'}
function backToChoose(){location.href='index.html?choose=1'}
function applyRoleUI(){
  const isTeacher = currentRole==='teacher';
  const toggle=(el,show)=>{if(el)el.style.display=show?'':'none'};
  toggle(document.getElementById('hwAddBtn'),isTeacher);
  toggle(document.getElementById('noticeAddBtn'),isTeacher);
  toggle(document.querySelector('#view-schedule .btn-primary'),isTeacher);
  toggle(document.querySelector('#view-grades .btn-primary'),isTeacher);
  toggle(document.getElementById('hintSchedule'),!isTeacher);
  toggle(document.getElementById('hintHomework'),!isTeacher);
  toggle(document.getElementById('hintGrades'),!isTeacher);
  const rt=document.getElementById('switchRoleBtn');
  if(rt)rt.title=isTeacher?'老师端：可管理课程表/作业/成绩/通知 · 点击切换端':(currentRole==='parent'?'家长端：查看课程表/作业/成绩与通知 · 点击切换端':'学生端：浏览与勾选完成进度 · 点击切换端');
}
/* 所有模块的渲染入口（统一注册，避免模块未定义时报错） */
const RENDERERS=[];
function renderAll(){RENDERERS.forEach(fn=>{try{fn()}catch(e){console.warn('render error',e)}})}


/* Same-browser cross-tab sync (fallback / supplement) */
let bc=null;
try{bc=new BroadcastChannel('studyhub_sync')}catch(e){bc=null}
function broadcastSync(){
  try{if(bc)bc.postMessage({type:'sync',ts:Date.now()})}catch(e){}
}
if(bc){
  bc.onmessage=(e)=>{
    if(e.data&&e.data.type==='sync'){
      const fresh=DB.get(DB.key,null);
      if(fresh){store=fresh;renderAll()}
    }
  };
}
window.addEventListener('storage',(e)=>{
  if(e.key===DB.key){
    const fresh=DB.get(DB.key,null);
    if(fresh){store=fresh;renderAll()}
  }
});

/* ============ GitHub 仓库文件同步引擎 ============ */
ghSync={
  cfg:Object.assign({},GH_DEFAULTS,DB.get(GH_CFG_KEY,null)||{}),
  sha:null, pushTimer:null, pollTimer:null, pushing:false, pulling:false, applying:false, lastPull:0,
  token(){return DBraw(GH_TOKEN_KEY,'')},
  setToken(t){DBrawSet(GH_TOKEN_KEY,t||'')},
  saveCfg(c){this.cfg=Object.assign({},GH_DEFAULTS,c||{});DBrawSet(GH_CFG_KEY,this.cfg)},
  ready(){return !!(this.cfg.owner&&this.cfg.repo&&this.token())},
  apiUrl(){
    const {owner,repo,path,branch}=this.cfg;
    const qs=[];if(branch)qs.push('ref='+encodeURIComponent(branch));
    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?${qs.join('&')}`;
  },
  headers(){
    // 注意：不要加 Cache-Control —— GitHub 的 CORS 预检不允许该请求头，会导致 fetch 直接被浏览器拦截
    // 禁用缓存已由 URL 上的 _=timestamp 参数与 fetch 的 cache:'no-store' 完成
    const h={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    if(this.token())h['Authorization']='Bearer '+this.token();
    return h;
  },
  start(){
    if(!this.ready()){setSyncStatus('unconfigured');return}
    clearInterval(this.pollTimer);
    this.pull(true);
    this.pollTimer=setInterval(()=>{if(document.visibilityState==='visible')this.pull()},20000);
  },
  stop(){clearInterval(this.pollTimer);this.pollTimer=null;setSyncStatus('unconfigured')},
  /* 拉取远端 → 远端更新时间更晚则覆盖本地，否则把本地推上去 */
  async pull(initial){
    if(!this.ready()||this.pulling)return;
    this.pulling=true;
    if(initial)setSyncStatus('syncing');
    try{
      const res=await fetch(this.apiUrl()+'&_='+Date.now(),{headers:this.headers(),cache:'no-store'});
      if(res.status===404){ // 文件不存在 → 创建
        this.sha=null;this.pulling=false,this.pushing=false;await this.push();return;
      }
      if(res.status===401||res.status===403)throw new Error('令牌无效或权限不足');
      if(!res.ok)throw new Error('HTTP '+res.status);
      const info=await res.json();
      this.sha=info.sha;
      const payload=JSON.parse(this.decode(info.content));
      this.lastPull=Date.now();
      if(payload&&payload.data){
        const remoteAt=+(payload.updatedAt||0);
        const localAt=+((store._meta&&store._meta.updatedAt)||0);
        if(remoteAt>localAt)this.apply(payload);
        else if(localAt>remoteAt)this.push();
      }
      setSyncStatus('online');
    }catch(e){
      console.warn('同步拉取失败：',e.message);
      setSyncStatus('offline');
    }
    finally{this.pulling=false}
  },
  apply(payload){
    this.applying=true;
    const tp=store.teacherPwd, pp=store.parentPwd;   // 老师/家长密码仅存本机，不随同步数据覆盖
    const myStudents=(store.students||[]).slice();   // 本机已登记的学生姓名
    store=Object.assign({},DEFAULT_STORE,payload.data);
    Object.keys(DEFAULT_STORE).forEach(k=>{if(store[k]===undefined)store[k]=DEFAULT_STORE[k]});
    store.teacherPwd=tp||null;store.parentPwd=pp||null;
    // 学生名单取并集，避免某台设备刚登记的姓名被远端旧数据覆盖丢失
    store.students=Array.from(new Set([...(store.students||[]),...myStudents]));
    store._meta={updatedAt:+payload.updatedAt||Date.now(),device:payload.device||'remote'};
    DB.set(DB.key,store);
    applyTheme();renderAll();updateGreeting();
    this.applying=false;
    toast('已同步其他设备的最新数据');
  },
  /* 本地改动 → 延迟合并后推送（防抖，避免频繁提交） */
  schedulePush(){
    if(!this.ready())return;
    clearTimeout(this.pushTimer);
    this.pushTimer=setTimeout(()=>this.push(),1500);
  },
  async push(){
    if(!this.ready()||this.pushing||this.applying)return;
    this.pushing=true;setSyncStatus('syncing');
    try{
      if(!store._meta||!store._meta.updatedAt)store._meta={updatedAt:Date.now(),device:DEVICE_ID};
      const remoteData=Object.assign({},store);
      delete remoteData.teacherPwd;delete remoteData.parentPwd;   // 密码哈希不上传，仅保存在本机
      const payload={v:1,updatedAt:store._meta.updatedAt,device:store._meta.device||DEVICE_ID,data:remoteData};
      const body={
        message:`同步数据 · ${new Date().toLocaleString('zh-CN')}`,
        content:this.encode(JSON.stringify(payload)),
        branch:this.cfg.branch||'main'
      };
      if(this.sha)body.sha=this.sha;
      const res=await fetch(`https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${this.cfg.path}`,{
        method:'PUT',headers:Object.assign({'Content-Type':'application/json'},this.headers()),body:JSON.stringify(body)
      });
      if(res.status===409||res.status===422){ // sha 冲突 → 先拉取再重试
        this.sha=null;this.pushing=false;await this.pull();return;
      }
      if(!res.ok)throw new Error('HTTP '+res.status);
      const j=await res.json();
      this.sha=j.content&&j.content.sha;
      setSyncStatus('online');
    }catch(e){
      console.warn('同步推送失败：',e.message);
      setSyncStatus('offline');
    }
    finally{this.pushing=false}
  },
  /* 仅用于「测试连接」 */
  async test(){
    const res=await fetch(this.apiUrl()+'&_='+Date.now(),{headers:this.headers(),cache:'no-store'});
    if(res.status===404)return {ok:true,note:'仓库可访问，数据文件将在首次保存时自动创建'};
    if(res.status===401)throw new Error('令牌无效（401）');
    if(res.status===403)throw new Error('权限不足或触发限流（403）');
    if(!res.ok)throw new Error('HTTP '+res.status);
    const info=await res.json();
    return {ok:true,note:`文件已存在（${info.size||0} 字节，最近提交 ${info.sha.slice(0,7)}）`};
  },
  /* Unicode 安全的 base64 编解码 */
  encode(str){return btoa(unescape(encodeURIComponent(str)))},
  decode(b64){
    const bin=atob(String(b64||'').replace(/\s/g,''));
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  },
  disconnect(){
    this.stop();
    DBrawSet(GH_TOKEN_KEY,'');
    this.sha=null;
  }
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ghSync.ready())ghSync.pull()});

/* 启动同步 */
ghSync.start();

/* ============ Navigation ============ */
function navTo(v){
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active',i.dataset.view===v));
  document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));
  const sec=document.getElementById('view-'+v);if(sec)sec.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');
  if(v==='stats')setTimeout(()=>{try{stats.render()}catch(e){}},50);
  if(v==='grades')setTimeout(()=>{try{grades.render()}catch(e){}},50);
  window.scrollTo(0,0);
}
document.getElementById('nav').addEventListener('click',e=>{
  const item=e.target.closest('.nav-item');if(!item)return;
  navTo(item.dataset.view);
});
document.getElementById('menuBtn').onclick=()=>document.getElementById('sidebar').classList.toggle('open');

/* Greeting */
function updateGreeting(){
  const h=new Date().getHours();
  let g='你好';
  if(h<6)g='夜深了';else if(h<11)g='早上好';else if(h<14)g='中午好';else if(h<18)g='下午好';else g='晚上好';
  const d=new Date();const w=['日','一','二','三','四','五','六'];
  const greet=persona.label();
  document.getElementById('greeting').innerHTML=`${g}，${greet}<small>${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 · 星期${w[d.getDay()]}</small>`;
}
updateGreeting();

/* 切换端 */
document.getElementById('switchRoleBtn').onclick=()=>backToChoose();

/* Theme */
function applyTheme(){
  document.documentElement.classList.toggle('dark',store.theme==='dark');
}
function cssv(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||'#888'}
function chartTheme(){return {muted:cssv('--muted')||'#888',border:cssv('--border')||'#e7e5ef'}}
function refreshCharts(){
  if(document.getElementById('view-stats').classList.contains('active'))stats.render();
  if(document.getElementById('view-grades').classList.contains('active'))grades.render();
}
applyTheme();
document.getElementById('themeBtn').onclick=()=>{
  store.theme=store.theme==='dark'?'light':'dark';
  applyTheme();save();refreshCharts();
};

/* Export / Import */
function doExport(){
  const clean=JSON.parse(JSON.stringify(store));
  delete clean.teacherPwd;delete clean.parentPwd;   // 密码哈希不随备份导出
  delete clean._meta;
  const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`zhixueyun-${todayStr()}.json`;a.click();
  toast('数据已导出');
}
function doImport(){document.getElementById('importFile').click()}
function clearAllData(){
  if(!confirm('确定清空本机全部数据？任务 / 课程表 / 作业 / 通知 / 成绩 / 笔记 / 倒计时等都会被删除，且不可恢复。'))return;
  const tp=store.teacherPwd, pp=store.parentPwd, th=store.theme;
  store=Object.assign({},DEFAULT_STORE);
  store.teacherPwd=tp;store.parentPwd=pp;store.theme=th||'light';
  save();applyTheme();renderAll();updateGreeting();
  toast('本机数据已清空');
}
document.getElementById('exportBtn').onclick=doExport;
document.getElementById('importBtn').onclick=doImport;
document.getElementById('importFile').onchange=(e)=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      const tp=store.teacherPwd, pp=store.parentPwd;   // 保留本机已设置的老师/家长密码
      store=Object.assign({},DEFAULT_STORE,data);
      Object.keys(DEFAULT_STORE).forEach(k=>{if(store[k]===undefined)store[k]=DEFAULT_STORE[k]});
      store.teacherPwd=tp;store.parentPwd=pp;
      save();applyTheme();renderAll();updateGreeting();
      toast('数据已导入');
    }catch(err){toast('导入失败：文件格式错误')}
  };
  r.readAsText(f);
};

/* ============ 同步与设置（GitHub 仓库同步 + 老师端密码） ============ */
const syncSettings={
  open(){
    const c=ghSync.cfg, token=ghSync.token();
    const status=ghSync.ready()
      ? '<span style="color:var(--success)">● 已开启 · 每 20 秒自动拉取</span>'
      : '<span style="color:var(--muted)">● 未开启 · 仅本地存储</span>';
    openModal('设置',`
      <div style="display:grid;gap:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn btn-ghost" onclick="syncSettings.toggleTheme()">🌓 切换深浅色</button>
          <button class="btn btn-ghost" onclick="doExport()">⬇ 导出数据</button>
          <button class="btn btn-ghost" onclick="doImport()">⬆ 导入数据</button>
          <button class="btn btn-ghost" onclick="clearAllData()" style="color:var(--danger)">🗑 清空本机数据</button>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:14px">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px">切换端</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <button class="btn btn-ghost" onclick="gotoRole('teacher')">👨‍🏫 老师端</button>
            <button class="btn btn-ghost" onclick="gotoRole('student')">🧑‍🎓 学生端</button>
            <button class="btn btn-ghost" onclick="gotoRole('parent')">👨‍👩‍👧 家长端</button>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:14px">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px">当前身份</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px">
            <span>${ROLE_META[currentRole].icon} ${esc(persona.label())}</span>
            ${currentRole==='teacher'?'':`<button class="btn btn-ghost btn-sm" onclick="persona.change()">${currentRole==='student'?'修改姓名':'更改绑定的学生'}</button>`}
          </div>
          ${currentRole==='teacher'?`<div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.6">学生名单（${(store.students||[]).length} 人）：${(store.students||[]).map(n=>esc(n)).join('、')||'暂无 —— 学生首次进入学生端时会自动登记'}</div>`:''}
        </div>
        <div style="border-top:1px solid var(--border);padding-top:14px">
          <div style="font-size:13px;line-height:1.7;background:var(--surface-2);padding:12px;border-radius:10px">
            <div style="font-weight:700;margin-bottom:6px">同步状态：${status}</div>
            数据保存在 GitHub 仓库的一个 JSON 文件里，老师 / 学生 / 家长各端读写同一文件即可同步。
            <div style="font-size:11px;color:var(--muted);margin-top:6px">页面版本 v${APP_VERSION} · 若与最新版号不符，请强制刷新页面（⌘⇧R / Ctrl+F5）</div>
          </div>
        </div>
        <details style="font-size:12px;color:var(--muted);line-height:1.7">
          <summary style="cursor:pointer;font-weight:600">📋 如何开启同步（3 步）</summary>
          <div style="margin-top:8px;padding-left:4px">
            1. 打开 <b>github.com/settings/tokens</b> 生成一个 Personal access token（勾选 <b>repo</b> 权限）<br>
            2. 填入下方仓库信息（默认已填当前站点仓库），令牌粘贴到 Token 输入框<br>
            3. 点击「保存并同步」，之后各设备打开页面会自动同步
          </div>
        </details>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label class="lbl">仓库所有者 owner</label><input class="input" id="gh_owner" value="${esc(c.owner||'')}"></div>
          <div><label class="lbl">仓库名 repo</label><input class="input" id="gh_repo" value="${esc(c.repo||'')}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label class="lbl">分支 branch</label><input class="input" id="gh_branch" value="${esc(c.branch||'main')}"></div>
          <div><label class="lbl">数据文件路径</label><input class="input" id="gh_path" value="${esc(c.path||'data.json')}"></div>
        </div>
        <div>
          <label class="lbl">访问令牌 Token</label>
          <input class="input" id="gh_token" type="password" value="${esc(token)}" placeholder="ghp_... / github_pat_..." autocomplete="off">
          <div style="font-size:11px;color:var(--muted);margin-top:5px">令牌只保存在本设备浏览器，不会随同步数据上传，请勿在公共设备填写。</div>
        </div>
        <div id="gh_result" style="font-size:12px;color:var(--muted)"></div>
        <div style="border-top:1px solid var(--border);padding-top:14px;display:grid;gap:14px">
          <div style="font-weight:700;font-size:13px">进入密码设置</div>
          ${['teacher','parent'].map(r=>{
            const m=ROLE_META[r];
            const st=auth.isDefault(r)?'<span style="color:var(--warn)">初始密码 123456</span>'
              :(auth.has(r)?'<span style="color:var(--success)">已自定义</span>':'<span style="color:var(--muted)">未设置</span>');
            return `<div>
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${m.name}端密码</div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:8px">当前：${st} · 进入${m.name}端需验证</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <input class="input" id="pwd_${r}" type="password" placeholder="新密码（≥4 位）" style="flex:1;min-width:150px" autocomplete="off">
                <button class="btn btn-ghost btn-sm" onclick="syncSettings.setPwd('${r}')">保存</button>
                <button class="btn btn-ghost btn-sm" onclick="syncSettings.resetPwd('${r}')">重置为 123456</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">关闭</button>
       <button class="btn btn-ghost" onclick="syncSettings.test()">测试连接</button>
       <button class="btn btn-primary" onclick="syncSettings.save()">保存并同步</button>`);
  },
  read(){
    return {
      owner:document.getElementById('gh_owner').value.trim(),
      repo:document.getElementById('gh_repo').value.trim(),
      branch:document.getElementById('gh_branch').value.trim()||'main',
      path:document.getElementById('gh_path').value.trim()||'data.json'
    };
  },
  save(){
    const cfg=this.read(), token=document.getElementById('gh_token').value.trim();
    if(!cfg.owner||!cfg.repo){toast('请填写 owner 和 repo');return}
    if(!token){toast('请填写访问令牌');return}
    ghSync.saveCfg(cfg);ghSync.setToken(token);ghSync.sha=null;
    closeModal();
    toast('配置已保存，正在连接...');
    ghSync.start();
  },
  async test(){
    const cfg=this.read(), token=document.getElementById('gh_token').value.trim();
    const out=document.getElementById('gh_result');
    if(!cfg.owner||!cfg.repo){out.innerHTML='<span style="color:var(--danger)">请先填写 owner 和 repo</span>';return}
    if(!token){out.innerHTML='<span style="color:var(--danger)">请先填写访问令牌</span>';return}
    out.textContent='正在测试连接...';
    const bCfg=Object.assign({},ghSync.cfg), bTok=ghSync.token();
    ghSync.cfg=cfg;ghSync.setToken(token);
    try{const r=await ghSync.test();out.innerHTML=`<span style="color:var(--success)">✓ 连接成功：${esc(r.note)}</span>`}
    catch(e){
      const m=(e&&e.message)?e.message:String(e);
      const net=/Failed to fetch|Load failed|NetworkError|network/i.test(m);
      out.innerHTML=`<span style="color:var(--danger)">✗ 连接失败：${esc(m)}（页面版本 v${APP_VERSION}）</span>`
        +(net?`<div style="color:var(--muted);margin-top:6px;line-height:1.6">这类报错通常是两种情况：① 浏览器仍在运行缓存的旧脚本 → 强制刷新（⌘⇧R / Ctrl+F5）后重试；② 浏览器或扩展拦截了 api.github.com。若强制刷新后仍失败，请把这一整条报错发我。</div>`:'');
    }
    ghSync.cfg=bCfg;ghSync.setToken(bTok);
  },
  async setPwd(role){
    const v=(document.getElementById('pwd_'+role)||{}).value||'';
    if(v.length<4){toast('密码至少 4 位');return}
    await auth.setPwd(role,v);auth.unlock(role);
    toast(ROLE_META[role].name+'端密码已更新');closeModal();
  },
  resetPwd(role){
    if(!confirm(`确定将${ROLE_META[role].name}端密码重置为初始密码 ${DEF_PWD}？`))return;
    auth.resetPwd(role);auth.unlock(role);closeModal();
    toast(ROLE_META[role].name+'端密码已重置为 '+DEF_PWD);
  },
  toggleTheme(){
    store.theme=store.theme==='dark'?'light':'dark';
    applyTheme();save();refreshCharts();
    toast('已切换为'+(store.theme==='dark'?'深色':'浅色')+'模式');
  }
};
document.getElementById('settingsBtn').onclick=()=>syncSettings.open();
document.getElementById('syncBtn').onclick=()=>syncSettings.open();

/* Modal */
let modalLocked=false;   // 身份类弹窗必须完成填写才能关闭
function openModal(title,bodyHtml,footHtml,locked){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=bodyHtml;
  document.getElementById('modalFoot').innerHTML=footHtml;
  document.getElementById('modalMask').classList.add('show');
  modalLocked=!!locked;
}
function closeModal(force){
  if(modalLocked&&!force)return;
  modalLocked=false;
  document.getElementById('modalMask').classList.remove('show');
}
document.getElementById('modalMask').onclick=(e)=>{if(e.target.id==='modalMask')closeModal()};
function submitModal(){const b=document.querySelector('#modalFoot .btn-primary');if(b)b.click()}
/* ESC 关闭弹窗；Enter 提交（表格内 Ctrl/⌘+Enter 提交） */
document.addEventListener('keydown',e=>{
  const lock=document.getElementById('lockMask');
  if(lock.classList.contains('show')){
    if(e.key==='Enter'){e.preventDefault();auth.lockSubmit()}
    return;
  }
  const mask=document.getElementById('modalMask');
  if(!mask.classList.contains('show'))return;
  if(e.key==='Escape'){e.preventDefault();closeModal();return}
  if(e.key!=='Enter')return;
  const t=e.target;
  if(t&&t.tagName==='TEXTAREA'){if(e.ctrlKey||e.metaKey){e.preventDefault();submitModal()}return}
  if(t&&t.tagName==='INPUT'){
    if(t.type==='date'||t.type==='number'||t.type==='file')return;
    e.preventDefault();submitModal();
  }
});

/* 悬浮快捷按钮 */
const fab={
  open:false,
  init(){
    const btn=document.getElementById('fabBtn'), menu=document.getElementById('fabMenu');
    if(!btn||!menu)return;
    btn.onclick=()=>{this.toggle()};
    menu.addEventListener('click',e=>{
      const it=e.target.closest('.fab-item');if(!it)return;
      this.toggle(false);
      const act=it.dataset.act;
      if(act==='task')tasks.openModal();
      else if(act==='note')notes.openModal();
      else if(act==='focus'){navTo('pomodoro');setTimeout(()=>{try{pomodoro.start&&pomodoro.start()}catch(e){}},60)}
      else if(act==='top')window.scrollTo({top:0,behavior:'smooth'});
      else if(act==='switch')backToChoose();
    });
    document.addEventListener('click',e=>{if(this.open&&!e.target.closest('#fabWrap'))this.toggle(false)});
  },
  toggle(force){
    const btn=document.getElementById('fabBtn'), menu=document.getElementById('fabMenu');
    if(!btn||!menu)return;
    this.open=(typeof force==='boolean')?force:!this.open;
    menu.classList.toggle('open',this.open);
    btn.classList.toggle('open',this.open);
  }
};
fab.init();

/* ============ 全局搜索（任务 / 作业 / 笔记 / 通知） ============ */
const search={
  timer:null,
  q(){return document.getElementById('globalSearch').value.trim()},
  close(){
    const p=document.getElementById('searchPanel');
    if(!p)return;
    p.classList.remove('show');p.innerHTML='';
  },
  run(){
    const q=this.q().toLowerCase();
    const panel=document.getElementById('searchPanel');
    if(!q){this.close();return}
    const rx=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
    const hl=s=>esc(s).replace(rx,m=>`<mark>${m}</mark>`);
    const hit=(s)=>(s||'').toLowerCase().includes(q);
    const groups=[]; let list=[];
    store.tasks.forEach(t=>{if(hit(t.title+' '+(t.desc||'')+' '+(t.category||'')))list.push({type:'tasks',icon:'✅',id:t.id,title:t.title,sub:[t.category,t.desc].filter(Boolean).join(' · ')})});
    if(list.length)groups.push(['任务',list]); list=[];
    store.homework.forEach(h=>{if(hit(h.title+' '+(h.desc||'')+' '+(h.subject||'')))list.push({type:'homework',icon:'📚',id:h.id,title:h.title,sub:[h.subject,h.desc].filter(Boolean).join(' · ')})});
    if(list.length)groups.push(['作业',list]); list=[];
    store.notes.forEach(n=>{if(hit((n.title||'')+' '+(n.body||'')))list.push({type:'notes',icon:'📝',id:n.id,title:n.title||'无标题',sub:(n.body||'').slice(0,70)})});
    if(list.length)groups.push(['笔记',list]); list=[];
    store.notices.forEach(n=>{if(hit((n.title||'')+' '+(n.content||'')))list.push({type:'notices',icon:'🔔',id:n.id,title:n.title,sub:(n.content||'').slice(0,70)})});
    if(list.length)groups.push(['通知',list]);
    if(!groups.length){
      panel.innerHTML='<div style="padding:18px;text-align:center;color:var(--muted);font-size:13px">未找到匹配结果</div>';
      panel.classList.add('show');return;
    }
    panel.innerHTML=groups.map(([name,items])=>
      `<div class="search-group">${name}</div>`+
      items.slice(0,5).map(it=>`<div class="search-item" onclick="search.go('${it.type}','${it.id}')">
        <div class="ic2">${it.icon}</div>
        <div style="min-width:0;flex:1"><span class="t">${hl(it.title)}</span>${it.sub?`<span class="s">${hl(it.sub)}</span>`:''}</div>
      </div>`).join('')
    ).join('');
    panel.classList.add('show');
  },
  go(view,id){
    const q=this.q();
    document.getElementById('globalSearch').value='';
    this.close();
    if(view==='tasks'){
      navTo('tasks');
      const box=document.getElementById('taskSearch');
      if(box){box.value=q}
      tasks.filter='all';
      document.querySelectorAll('#view-tasks .chip').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));
      tasks.render();
    }else if(view==='notes'){
      navTo('notes');notes.openModal(id);
    }else{
      navTo(view);
      this.flash(view==='homework'?'hwList':'noticeList',id);
    }
  },
  flash(containerId,id){
    const box=document.getElementById(containerId);
    if(!box)return;
    const el=box.querySelector(`[data-id="${id}"]`);
    if(!el)return;
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');
  }
};
(function(){
  const gs=document.getElementById('globalSearch');
  gs.addEventListener('input',()=>{clearTimeout(search.timer);search.timer=setTimeout(()=>search.run(),160)});
  gs.addEventListener('focus',()=>{if(search.q())search.run()});
  gs.addEventListener('keydown',e=>{
    if(e.key==='Escape'){search.close();gs.blur()}
    if(e.key==='Enter'){const first=document.querySelector('#searchPanel .search-item');if(first){e.preventDefault();first.click()}}
  });
  document.addEventListener('click',e=>{
    const wrap=document.getElementById('searchWrap');
    if(wrap&&!wrap.contains(e.target))search.close();
  });
})();

/* ============ Tasks Module ============ */
const tasks={
  filter:'all',cat:'',pri:'',search:'',
  render(){
    const s=document.getElementById('taskSearch').value.toLowerCase();
    let list=store.tasks.filter(t=>{
      if(s&&!(t.title.toLowerCase().includes(s)||(t.desc||'').toLowerCase().includes(s)))return false;
      if(this.cat&&t.category!==this.cat)return false;
      if(this.pri&&t.priority!==this.pri)return false;
      const due=t.due;
      if(this.filter==='pending'&&t.done)return false;
      if(this.filter==='done'&&!t.done)return false;
      if(this.filter==='today'&&due!==todayStr())return false;
      if(this.filter==='overdue'&&(t.done||!due||due>=todayStr()))return false;
      return true;
    });
    list.sort((a,b)=>{
      if(a.done!==b.done)return a.done?1:-1;
      const pa={high:0,mid:1,low:2};if(pa[a.priority]!==pa[b.priority])return pa[a.priority]-pa[b.priority];
      return (a.due||'9999').localeCompare(b.due||'9999');
    });
    const cats={};
    store.tasks.forEach(t=>cats[t.category]=(cats[t.category]||0)+1);
    const catSel=document.getElementById('catFilter');
    catSel.innerHTML='<option value="">全部分类</option>'+Object.keys(cats).map(c=>`<option value="${c}" ${this.cat===c?'selected':''}>${c}</option>`).join('');
    const el=document.getElementById('taskList');
    if(list.length===0){el.innerHTML='<div class="card card-pad empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><div>暂无任务，点击「新建任务」开始规划</div></div>';return}
    const priMap={high:['高','tag-high'],mid:['中','tag-mid'],low:['低','tag-low']};
    el.innerHTML=list.map(t=>`
      <div class="task-item ${t.done?'done':''}">
        <div class="check ${t.done?'checked':''}" onclick="tasks.toggle('${t.id}')">${t.done?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>':''}</div>
        <div class="task-body">
          <div class="task-title">${t.title}</div>
          <div class="task-meta">
            <span class="tag tag-cat">${t.category||'未分类'}</span>
            <span class="tag ${priMap[t.priority]?.[1]||'tag-low'}">${priMap[t.priority]?.[0]||'低'}</span>
            ${t.due?`<span>📅 ${fmtDate(t.due)}${t.due<todayStr()&&!t.done?' <span style="color:var(--danger)">已逾期</span>':''}</span>`:''}
            ${t.desc?`<span>📝 ${t.desc}</span>`:''}
          </div>
        </div>
        <div class="task-actions">
          <button onclick="tasks.openModal('${t.id}')" title="编辑"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button onclick="tasks.del('${t.id}')" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </div>`).join('');
  },
  openModal(id){
    const t=id?store.tasks.find(x=>x.id===id):{title:'',desc:'',category:'学习',priority:'mid',due:todayStr()};
    openModal(id?'编辑任务':'新建任务',`
      <div style="display:grid;gap:12px">
        <div><label class="lbl">任务标题</label><input class="input" id="t_title" value="${t.title||''}"></div>
        <div><label class="lbl">描述</label><textarea class="textarea" id="t_desc">${t.desc||''}</textarea></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label class="lbl">分类</label><select class="select" id="t_cat">
            ${['学习','生活','社团','考试','其他'].map(c=>`<option ${t.category===c?'selected':''}>${c}</option>`).join('')}
          </select></div>
          <div><label class="lbl">优先级</label><select class="select" id="t_pri">
            <option value="high" ${t.priority==='high'?'selected':''}>高</option>
            <option value="mid" ${t.priority==='mid'?'selected':''}>中</option>
            <option value="low" ${t.priority==='low'?'selected':''}>低</option>
          </select></div>
        </div>
        <div><label class="lbl">截止日期</label><input type="date" class="input" id="t_due" value="${t.due||''}"></div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="tasks.save('${id||''}')">保存</button>`);
  },
  save(id){
    const data={
      title:document.getElementById('t_title').value.trim(),
      desc:document.getElementById('t_desc').value.trim(),
      category:document.getElementById('t_cat').value,
      priority:document.getElementById('t_pri').value,
      due:document.getElementById('t_due').value
    };
    if(!data.title){toast('请填写标题');return}
    if(id){Object.assign(store.tasks.find(t=>t.id===id),data)}
    else{store.tasks.push({id:uid(),...data,done:false,createdAt:Date.now()})}
    save();closeModal();tasks.render();dashboard.render();
    toast(id?'已更新':'已创建');
  },
  toggle(id){const t=store.tasks.find(x=>x.id===id);t.done=!t.done;save();tasks.render();dashboard.render()},
  del(id){if(confirm('确定删除此任务？')){store.tasks=store.tasks.filter(t=>t.id!==id);save();tasks.render();dashboard.render();toast('已删除')}}
};
document.querySelectorAll('#view-tasks .chip').forEach(c=>c.onclick=()=>{
  document.querySelectorAll('#view-tasks .chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');tasks.filter=c.dataset.filter;tasks.render();
});
document.getElementById('catFilter').onchange=e=>{tasks.cat=e.target.value;tasks.render()};
document.getElementById('priFilter').onchange=e=>{tasks.pri=e.target.value;tasks.render()};
document.getElementById('taskSearch').addEventListener('input',()=>tasks.render());

/* ============ Schedule Module ============ */
const schedule={
  weekOffset:0,
  render(){
    const colors=['#6d5efc','#f59e0b','#10b981','#ef4444','#06b6d4','#8b5cf6','#ec4899','#14b8a6'];
    const colorFor=(name)=>{let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);return colors[Math.abs(h)%colors.length]};
    const days=['日','一','二','三','四','五','六'];
    const start=new Date();start.setDate(start.getDate()-start.getDay()+this.weekOffset*7);
    const end=new Date(start);end.setDate(end.getDate()+6);
    document.getElementById('weekLabel').textContent=`${start.getMonth()+1}/${start.getDate()} - ${end.getMonth()+1}/${end.getDate()}`;
    const periods=[
      {n:1,time:'08:00-08:45'},{n:2,time:'08:55-09:40'},{n:3,time:'10:00-10:45'},{n:4,time:'10:55-11:40'},
      {n:5,time:'14:00-14:45'},{n:6,time:'14:55-15:40'},{n:7,time:'16:00-16:45'},{n:8,time:'16:55-17:40'},
      {n:9,time:'19:00-19:45'},{n:10,time:'19:55-20:40'}
    ];
    let html='';
    // header
    html+='<div class="sched-head"></div>';
    for(let i=0;i<7;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const isToday=todayStr()===`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      html+=`<div class="sched-head ${isToday?'today':''}">周${days[i]}<br><span style="font-size:10px;opacity:.8">${d.getMonth()+1}/${d.getDate()}</span></div>`;
    }
    periods.forEach((p,pi)=>{
      html+=`<div class="sched-time">${p.n}<br><span style="font-size:9px">${p.time.split('-')[0]}</span></div>`;
      for(let di=0;di<7;di++){
        const d=new Date(start);d.setDate(start.getDate()+di);
        const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const c=store.schedule.find(x=>x.day===di&&x.period===p.n);
        if(c){
          const col=colorFor(c.name);
          const clickable=currentRole==='teacher'?`onclick="schedule.openModal('${c.id}')"`:'';
          html+=`<div class="sched-cell" ${clickable}><div class="course-chip" style="background:${col}">
            <div>${c.name}</div><div class="loc">📍${c.location||''}</div></div></div>`;
        }else{
          const clickable=currentRole==='teacher'?`onclick="schedule.openModal('','${ds}',${p.n},${di})"`:'';
          html+=`<div class="sched-cell" ${clickable}></div>`;
        }
      }
    });
    document.getElementById('schedGrid').innerHTML=html;
  },
  prevWeek(){this.weekOffset--;this.render()},
  nextWeek(){this.weekOffset++;this.render()},
  openModal(id,date,period,day){
    if(currentRole!=='teacher'){toast('仅老师可编辑课程表');return}
    const c=id?store.schedule.find(x=>x.id===id):{name:'',teacher:'',location:'',day:day||0,period:period||1};
    openModal(id?'编辑课程':'添加课程',`
      <div style="display:grid;gap:12px">
        <div><label class="lbl">课程名称</label><input class="input" id="s_name" value="${c.name||''}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label class="lbl">教师</label><input class="input" id="s_teacher" value="${c.teacher||''}"></div>
          <div><label class="lbl">地点</label><input class="input" id="s_loc" value="${c.location||''}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label class="lbl">星期</label><select class="select" id="s_day">
            ${['日','一','二','三','四','五','六'].map((d,i)=>`<option value="${i}" ${c.day===i?'selected':''}>周${d}</option>`).join('')}
          </select></div>
          <div><label class="lbl">节次</label><select class="select" id="s_period">
            ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${c.period===n?'selected':''}>第${n}节</option>`).join('')}
          </select></div>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">取消</button>`+
      (id?`<button class="btn btn-danger" onclick="schedule.del('${id}')">删除</button>`:'')+
      `<button class="btn btn-primary" onclick="schedule.save('${id||''}')">保存</button>`);
  },
  save(id){
    const data={
      name:document.getElementById('s_name').value.trim(),
      teacher:document.getElementById('s_teacher').value.trim(),
      location:document.getElementById('s_loc').value.trim(),
      day:parseInt(document.getElementById('s_day').value),
      period:parseInt(document.getElementById('s_period').value)
    };
    if(!data.name){toast('请填写课程名');return}
    if(id){Object.assign(store.schedule.find(x=>x.id===id),data)}
    else{store.schedule.push({id:uid(),...data})}
    save();closeModal();schedule.render();dashboard.render();toast(id?'已更新':'已添加');
  },
  del(id){store.schedule=store.schedule.filter(x=>x.id!==id);save();closeModal();schedule.render();dashboard.render();toast('已删除')}
};

/* ============ Homework Module ============ */
const homework={
  subject:'',status:'',
  stat(h){
    const items=h.items||[];
    const total=items.length||1;
    const done=items.length?items.filter(i=>i.done).length:(h.done?1:0);
    return {items,total,done,allDone:done>=total,pct:Math.round(done/total*100)};
  },
  render(){
    const list=[...store.homework].sort((a,b)=>(b.due||'').localeCompare(a.due||''));
    // subject filter options
    const subs={};store.homework.forEach(h=>subs[h.subject]=(subs[h.subject]||0)+1);
    const subSel=document.getElementById('hwSubjectFilter');
    if(subSel)subSel.innerHTML='<option value="">全部科目</option>'+Object.keys(subs).map(s=>`<option value="${s}" ${this.subject===s?'selected':''}>${s}</option>`).join('');
    // count pending for badge
    const pending=store.homework.filter(h=>!this.stat(h).allDone).length;
    const bc=document.getElementById('hwCount');if(bc)bc.textContent=pending;
    // role permission
    const canManage=currentRole==='teacher';
    const canCheck=currentRole==='student'||currentRole==='teacher';
    const tick='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>';
    const tickSm='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M20 6L9 17l-5-5"/></svg>';
    // filter
    let filtered=list.filter(h=>{
      const allDone=this.stat(h).allDone;
      if(this.subject&&h.subject!==this.subject)return false;
      if(this.status==='pending'&&allDone)return false;
      if(this.status==='done'&&!allDone)return false;
      if(this.status==='overdue'&&(allDone||!h.due||h.due>=todayStr()))return false;
      return true;
    });
    const el=document.getElementById('hwList');
    if(filtered.length===0){el.innerHTML='<div class="card card-pad empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg><div>暂无作业</div></div>';return}
    el.innerHTML=filtered.map(h=>{
      const {items,total,done,allDone,pct}=this.stat(h);
      const overdue=!allDone&&h.due&&h.due<todayStr();
      const itemHtml=items.length?`<div class="hw-items">${items.map(it=>`
          <div class="hw-item ${it.done?'done':''} ${canCheck?'clickable':''}" ${canCheck?`onclick="homework.toggleItem('${h.id}','${it.id}')"`:''}>
            <div class="box">${it.done?tickSm:''}</div>
            <div class="txt">${esc(it.text)}</div>
          </div>`).join('')}</div>`:'';
      const checkHtml=items.length?'':`<div class="check ${h.done?'checked':''}" ${canCheck?`onclick="homework.toggle('${h.id}')"`:''}>${h.done?tick:''}</div>`;
      return `<div class="task-item ${allDone?'done':''}" data-id="${h.id}">
        ${checkHtml}
        <div class="task-body">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div class="task-title ${allDone?'line':''}">${esc(h.title)}</div>
            ${allDone?'<span class="done-flag">✅ 全部完成</span>':''}
            <span class="prog-text" style="margin-left:auto">${done}/${total}</span>
          </div>
          <div class="task-meta">
            <span class="tag tag-cat">${esc(h.subject||'未分类')}</span>
            ${h.due?`<span>📅 截止 ${fmtDate(h.due)}${overdue?' <span style="color:var(--danger)">已逾期</span>':''}</span>`:''}
            <span>👨‍🏫 ${esc(h.teacher||'—')}</span>
          </div>
          ${h.desc?`<div style="font-size:12px;color:var(--muted);margin-top:4px">${esc(h.desc)}</div>`:''}
          <div class="progress ${allDone?'done':''}"><i style="width:${pct}%"></i></div>
          ${itemHtml}
        </div>
        <div class="task-actions">
          ${canManage?`<button onclick="homework.openModal('${h.id}')" title="编辑"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button onclick="homework.del('${h.id}')" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>`:''}
        </div>
      </div>`;
    }).join('');
  },
  openModal(id){
    if(currentRole!=='teacher'){toast('仅老师可布置作业');return}
    const h=id?store.homework.find(x=>x.id===id):{title:'',desc:'',subject:'',due:'',teacher:'',items:[]};
    const itemsText=(h.items||[]).map(i=>i.text).join('\n');
    openModal(id?'编辑作业':'布置作业',`
      <div style="display:grid;gap:12px">
        <div><label class="lbl">作业标题</label><input class="input" id="h_title" value="${esc(h.title||'')}" placeholder="如：第三章习题"></div>
        <div><label class="lbl">科目</label><input class="input" id="h_subject" value="${esc(h.subject||'')}" placeholder="如：高等数学"></div>
        <div><label class="lbl">描述</label><textarea class="textarea" id="h_desc">${esc(h.desc||'')}</textarea></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label class="lbl">截止日期</label><input type="date" class="input" id="h_due" value="${h.due||''}"></div>
          <div><label class="lbl">授课教师</label><input class="input" id="h_teacher" value="${esc(h.teacher||'')}" placeholder="如：王教授"></div>
        </div>
        <div>
          <label class="lbl">完成条目（每行一条，学生逐条勾选）</label>
          <textarea class="textarea" id="h_items" style="min-height:104px" placeholder="每行一条，例如：&#10;习题 1-5&#10;习题 6-10&#10;整理错题">${esc(itemsText)}</textarea>
          <div style="font-size:11px;color:var(--muted);margin-top:5px">留空则按「整份作业」单一勾选；填写后学生逐条勾选，全部勾选才显示 ✅。</div>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="homework.save('${id||''}')">保存</button>`);
  },
  save(id){
    const data={
      title:document.getElementById('h_title').value.trim(),
      subject:document.getElementById('h_subject').value.trim(),
      desc:document.getElementById('h_desc').value.trim(),
      due:document.getElementById('h_due').value,
      teacher:document.getElementById('h_teacher').value.trim()
    };
    if(!data.title){toast('请填写作业标题');return}
    const lines=(document.getElementById('h_items').value||'').split('\n').map(s=>s.trim()).filter(Boolean);
    if(id){
      const h=store.homework.find(x=>x.id===id);
      const hadItems=(h.items||[]).length>0;
      const prev=new Map((h.items||[]).map(it=>[it.text,it]));
      h.items=lines.map(t=>prev.get(t)||{id:uid(),text:t,done:false});
      if(h.items.length)h.done=h.items.every(i=>i.done);
      else if(hadItems)h.done=false;
      Object.assign(h,data);
    }else{
      const items=lines.map(t=>({id:uid(),text:t,done:false}));
      store.homework.push({id:uid(),...data,items,done:false,createdAt:Date.now()});
    }
    save();closeModal();homework.render();dashboard.render();toast(id?'已更新':'已布置');
  },
  toggle(id){
    const h=store.homework.find(x=>x.id===id);if(!h)return;
    h.done=!h.done;save();homework.render();dashboard.render();
    toast(h.done?'作业已完成 ✅':'已取消完成');
  },
  toggleItem(hid,iid){
    const h=store.homework.find(x=>x.id===hid);if(!h)return;
    const it=(h.items||[]).find(i=>i.id===iid);if(!it)return;
    it.done=!it.done;
    const left=h.items.filter(i=>!i.done).length;
    h.done=left===0;
    save();homework.render();dashboard.render();
    toast(left===0?'作业已全部完成 ✅':`已完成 ${h.items.length-left}/${h.items.length}`);
  },
  del(id){if(confirm('确定删除此作业？')){store.homework=store.homework.filter(x=>x.id!==id);save();homework.render();dashboard.render();toast('已删除')}}
};
document.getElementById('hwSubjectFilter').addEventListener('change',e=>{homework.subject=e.target.value;homework.render()});
document.getElementById('hwStatusFilter').addEventListener('change',e=>{homework.status=e.target.value;homework.render()});

/* ============ Notices Module ============ */
const notices={
  render(){
    const list=[...store.notices].sort((a,b)=>b.createdAt-a.createdAt);
    const unread=store.notices.filter(n=>!n.read).length;
    const bc=document.getElementById('noticeCount');if(bc)bc.textContent=unread;
    const el=document.getElementById('noticeList');
    if(list.length===0){el.innerHTML='<div class="card card-pad empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg><div>暂无通知</div></div>';return}
    const types={info:['通知','var(--info)'],warning:['提醒','var(--warn)'],urgent:['紧急','var(--danger)']};
    el.innerHTML=list.map(n=>{
      const t=types[n.type]||types.info;
      const canEdit=currentRole==='teacher';
      return `<div class="task-item" data-id="${n.id}" style="${n.read?'':'border-left:3px solid var(--primary)'}">
        <div class="task-body">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="tag" style="background:color-mix(in srgb,${t[1]} 15%,transparent);color:${t[1]}">${t[0]}</span>
            <div class="task-title">${n.title}</div>
            ${!n.read?'<span class="tag tag-high">新</span>':''}
          </div>
          <div class="task-meta">
            <span>👨‍🏫 ${n.from||'学校'}</span>
            <span>🕒 ${fmtDateTime(n.createdAt)}</span>
          </div>
          ${n.content?`<div style="font-size:13px;margin-top:6px;line-height:1.6">${n.content.replace(/\n/g,'<br>')}</div>`:''}
        </div>
        <div class="task-actions">
          ${!n.read?`<button onclick="notices.markRead('${n.id}')" title="标记已读"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></button>`:''}
          ${canEdit?`<button onclick="notices.openModal('${n.id}')" title="编辑"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button onclick="notices.del('${n.id}')" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>`:''}
        </div>
      </div>`;
    }).join('');
  },
  openModal(id){
    if(currentRole!=='teacher'){toast('仅老师可发布通知');return}
    const n=id?store.notices.find(x=>x.id===id):{title:'',content:'',from:'',type:'info'};
    openModal(id?'编辑通知':'发布通知',`
      <div style="display:grid;gap:12px">
        <div><label class="lbl">通知标题</label><input class="input" id="n_title" value="${n.title||''}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label class="lbl">类型</label><select class="select" id="n_type">
            <option value="info" ${n.type==='info'?'selected':''}>通知</option>
            <option value="warning" ${n.type==='warning'?'selected':''}>提醒</option>
            <option value="urgent" ${n.type==='urgent'?'selected':''}>紧急</option>
          </select></div>
          <div><label class="lbl">发布人</label><input class="input" id="n_from" value="${n.from||''}" placeholder="如：王老师"></div>
        </div>
        <div><label class="lbl">通知内容</label><textarea class="textarea" id="n_content" style="min-height:140px">${n.content||''}</textarea></div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="notices.save('${id||''}')">发布</button>`);
  },
  save(id){
    const data={
      title:document.getElementById('n_title').value.trim(),
      content:document.getElementById('n_content').value.trim(),
      from:document.getElementById('n_from').value.trim(),
      type:document.getElementById('n_type').value
    };
    if(!data.title){toast('请填写通知标题');return}
    if(id){Object.assign(store.notices.find(x=>x.id===id),data)}
    else{store.notices.push({id:uid(),...data,read:false,createdAt:Date.now()})}
    save();closeModal();notices.render();toast(id?'已更新':'已发布');
  },
  markRead(id){const n=store.notices.find(x=>x.id===id);n.read=true;save();notices.render()},
  del(id){if(confirm('确定删除此通知？')){store.notices=store.notices.filter(x=>x.id!==id);save();notices.render();toast('已删除')}}
};

/* ============ Calendar Module ============ */
const calendar={
  date:new Date(),
  render(){
    const y=this.date.getFullYear(),m=this.date.getMonth();
    document.getElementById('calTitle').textContent=`${y}年${m+1}月`;
    const first=new Date(y,m,1).getDay();
    const days=new Date(y,m+1,0).getDate();
    const prevDays=new Date(y,m,0).getDate();
    const today=todayStr();
    let html='';
    for(let i=0;i<first;i++){
      const d=prevDays-first+i+1;
      html+=`<div class="cal-cell other"><div class="cal-day">${d}</div></div>`;
    }
    for(let d=1;d<=days;d++){
      const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const tasks=store.tasks.filter(t=>t.due===ds);
      const cd=store.countdowns.find(c=>c.date===ds);
      let dots='';
      tasks.slice(0,3).forEach(t=>{dots+=`<span class="cal-dot" style="background:${t.done?'var(--success)':'var(--primary)'}"></span>`});
      if(cd)dots+=`<span class="cal-dot" style="background:var(--accent)"></span>`;
      html+=`<div class="cal-cell ${ds===today?'today':''}" onclick="calendar.dayDetail('${ds}')">
        <div class="cal-day">${d}</div>${dots}
        ${tasks.length?`<div style="font-size:10px;color:var(--muted);margin-top:3px">${tasks[0].title.slice(0,8)}${tasks.length>1?' +'+(tasks.length-1):''}</div>`:''}
      </div>`;
    }
    const total=first+days;
    const rem=(7-total%7)%7;
    for(let i=1;i<=rem;i++)html+=`<div class="cal-cell other"><div class="cal-day">${i}</div></div>`;
    document.getElementById('calGrid').innerHTML=html;
  },
  prev(){this.date.setMonth(this.date.getMonth()-1);this.render()},
  next(){this.date.setMonth(this.date.getMonth()+1);this.render()},
  today(){this.date=new Date();this.render()},
  dayDetail(ds){
    const ts=store.tasks.filter(t=>t.due===ds);
    const cd=store.countdowns.find(c=>c.date===ds);
    openModal(ds,`
      <div style="margin-bottom:12px;font-weight:600">任务 (${ts.length})</div>
      ${ts.length?ts.map(t=>`<div class="task-item" style="margin-bottom:6px">
        <div class="check ${t.done?'checked':''}" onclick="tasks.toggle('${t.id}');calendar.dayDetail('${ds}')">${t.done?'✓':''}</div>
        <div class="task-body"><div class="task-title ${t.done?'line':''}">${t.title}</div></div>
      </div>`).join(''):'<div style="color:var(--muted);font-size:13px">无任务</div>'}
      ${cd?`<div style="margin-top:14px;font-weight:600">倒计时</div><div class="cd-card" style="margin-top:6px"><div class="cd-title">${cd.title}</div><div class="cd-sub">${cd.date}</div></div>`:''}
    `,`<button class="btn btn-primary" onclick="closeModal()">关闭</button>`);
  }
};

/* ============ Grades Module ============ */
const grades={
  render(){
    const g=store.grades;
    const credits=g.reduce((s,x)=>s+(+x.credit||0),0);
    const score=g.reduce((s,x)=>s+(+x.score||0)*((+x.credit)||0),0);
    const avg=credits>0?score/credits:0;
    const gpa=grades.calcGPA(avg);
    document.getElementById('gpaValue').textContent=gpa.toFixed(2);
    document.getElementById('creditSum').textContent=credits;
    document.getElementById('avgScore').textContent=avg.toFixed(1);
    const tbl=document.getElementById('gradeTable');
    const canEdit=currentRole==='teacher';
    if(g.length===0){tbl.innerHTML='<div class="empty" style="padding:30px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/></svg>暂无成绩</div>';return}
    tbl.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:var(--muted);border-bottom:1px solid var(--border)">
        <th style="padding:8px">课程</th><th>学分</th><th>成绩</th><th>GPA</th>${canEdit?'<th>操作</th>':''}</tr></thead>
      <tbody>${g.map(x=>`<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 8px;font-weight:600">${x.name}</td>
        <td>${x.credit}</td>
        <td><span class="tag ${x.score>=90?'tag-low':x.score>=60?'tag-mid':'tag-high'}">${x.score}</span></td>
        <td>${grades.scoreToGPA(x.score).toFixed(2)}</td>
        ${canEdit?`<td><button class="btn btn-ghost btn-sm" onclick="grades.openModal('${x.id}')">编辑</button>
        <button class="btn btn-ghost btn-sm" onclick="grades.del('${x.id}')">删除</button></td>`:''}
      </tr>`).join('')}</tbody></table>`;
    // chart
    const ctx=document.getElementById('gradeChart');
    if(ctx._chart)ctx._chart.destroy();
    const th=chartTheme();
    ctx._chart=new Chart(ctx,{
      type:'bar',
      data:{labels:g.map(x=>x.name),datasets:[{label:'成绩',data:g.map(x=>x.score),backgroundColor:g.map(x=>x.score>=90?'#10b981':x.score>=60?'#f59e0b':'#ef4444'),borderRadius:6}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100,grid:{color:th.border},ticks:{color:th.muted}},x:{grid:{display:false},ticks:{color:th.muted}}}}
    });
  },
  scoreToGPA(s){s=+s;if(s>=90)return 4.0;if(s>=85)return 3.7;if(s>=82)return 3.3;if(s>=78)return 3.0;if(s>=75)return 2.7;if(s>=72)return 2.3;if(s>=68)return 2.0;if(s>=64)return 1.5;if(s>=60)return 1.0;return 0},
  calcGPA(avg){return grades.scoreToGPA(avg)},
  openModal(id){
    if(currentRole!=='teacher'){toast('仅老师可管理成绩');return}
    const g=id?store.grades.find(x=>x.id===id):{name:'',credit:'',score:''};
    openModal(id?'编辑成绩':'添加成绩',`
      <div style="display:grid;gap:12px">
        <div><label class="lbl">课程名称</label><input class="input" id="g_name" value="${g.name||''}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label class="lbl">学分</label><input type="number" class="input" id="g_credit" value="${g.credit||''}" min="0" step="0.5"></div>
          <div><label class="lbl">成绩 (0-100)</label><input type="number" class="input" id="g_score" value="${g.score||''}" min="0" max="100"></div>
        </div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="grades.save('${id||''}')">保存</button>`);
  },
  save(id){
    const data={name:document.getElementById('g_name').value.trim(),credit:+document.getElementById('g_credit').value,score:+document.getElementById('g_score').value};
    if(!data.name){toast('请填写课程名');return}
    if(id){Object.assign(store.grades.find(x=>x.id===id),data)}else{store.grades.push({id:uid(),...data})}
    save();closeModal();grades.render();toast('已保存');
  },
  del(id){if(confirm('确定删除？')){store.grades=store.grades.filter(x=>x.id!==id);save();grades.render();toast('已删除')}}
};

/* ============ Pomodoro Module ============ */
const pomodoro={
  mode:'focus',dur:{focus:25*60,short:5*60,long:15*60},left:25*60,timer:null,running:false,
  setMode(m){
    this.mode=m;this.left=this.dur[m];this.running=false;clearInterval(this.timer);
    document.querySelectorAll('#view-pomodoro .chip').forEach(c=>c.classList.toggle('active',c.dataset.mode===m));
    const lab={focus:'专注时间',short:'短休息',long:'长休息'}[m];
    document.getElementById('pomoLabel').textContent=lab;
    this.update();
  },
  update(){
    const m=Math.floor(this.left/60),s=this.left%60;
    const str=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.getElementById('pomoTime').textContent=str;
    document.getElementById('dashTimer').textContent=str;
    const total=this.dur[this.mode];
    const off=791.7*(1-this.left/total);
    document.getElementById('timerFg').style.strokeDashoffset=off;
  },
  start(){
    if(this.running)return;this.running=true;
    document.getElementById('pomoStartBtn').textContent='进行中';
    document.getElementById('dashStartBtn').textContent='专注中...';
    this.timer=setInterval(()=>{
      this.left--;this.update();
      if(this.left<=0){
        clearInterval(this.timer);this.running=false;
        document.getElementById('pomoStartBtn').textContent='开始';
        document.getElementById('dashStartBtn').textContent='开始专注';
        if(this.mode==='focus'){
          store.pomoLog.push({date:todayStr(),duration:25,ts:Date.now()});save();this.renderLog();dashboard.render();
          toast('专注完成！该休息了 🍅');
          this.setMode('short');
        }else{toast('休息结束，继续加油！');this.setMode('focus')}
      }
    },1000);
  },
  pause(){if(this.running){clearInterval(this.timer);this.running=false;document.getElementById('pomoStartBtn').textContent='继续';document.getElementById('dashStartBtn').textContent='继续'}},
  reset(){clearInterval(this.timer);this.running=false;this.left=this.dur[this.mode];this.update();document.getElementById('pomoStartBtn').textContent='开始';document.getElementById('dashStartBtn').textContent='开始专注'},
  renderLog(){
    const log=store.pomoLog.slice(-10).reverse();
    const el=document.getElementById('pomoLog');
    if(log.length===0){el.innerHTML='<div style="color:var(--muted);text-align:center;padding:20px">暂无专注记录</div>';return}
    el.innerHTML=log.map(l=>`<div class="task-item" style="margin-bottom:6px">
      <div class="task-body"><div class="task-title">🍅 专注 25 分钟</div><div class="task-meta">${fmtDateTime(l.ts)}</div></div>
    </div>`).join('');
  }
};
document.querySelectorAll('#view-pomodoro .chip').forEach(c=>c.onclick=()=>pomodoro.setMode(c.dataset.mode));

/* ============ Notes Module ============ */
const notes={
  colors:['#fef3c7','#fce7f3','#dbeafe','#d1fae5','#ede9fe','#fed7aa','#ccfbf1','#fee2e2'],
  render(){
    const el=document.getElementById('notesGrid');
    if(store.notes.length===0){el.innerHTML='<div class="card card-pad empty" style="grid-column:1/-1"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg><div>还没有笔记，点击「新建笔记」开始记录</div></div>';return}
    el.innerHTML=store.notes.map((n,i)=>`
      <div class="note-card" style="background:${this.colors[i%this.colors.length]};color:#1f1b2e" onclick="notes.openModal('${n.id}')">
        <button class="note-del" onclick="event.stopPropagation();notes.del('${n.id}')">×</button>
        <div class="note-title">${n.title||'无标题'}</div>
        <div class="note-body">${n.body||''}</div>
        <div class="note-date">${fmtDateTime(n.updatedAt||n.createdAt)}</div>
      </div>`).join('');
  },
  openModal(id){
    const n=id?store.notes.find(x=>x.id===id):{title:'',body:''};
    openModal(id?'编辑笔记':'新建笔记',`
      <div style="display:grid;gap:12px">
        <div><label class="lbl">标题</label><input class="input" id="n_title" value="${n.title||''}"></div>
        <div><label class="lbl">内容</label><textarea class="textarea" id="n_body" style="min-height:180px">${n.body||''}</textarea></div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="notes.save('${id||''}')">保存</button>`);
  },
  save(id){
    const data={title:document.getElementById('n_title').value.trim(),body:document.getElementById('n_body').value};
    if(id){Object.assign(store.notes.find(x=>x.id===id),data,{updatedAt:Date.now()})}
    else{store.notes.push({id:uid(),...data,createdAt:Date.now()})}
    save();closeModal();notes.render();toast('已保存');
  },
  del(id){if(confirm('删除此笔记？')){store.notes=store.notes.filter(x=>x.id!==id);save();notes.render();toast('已删除')}}
};

/* ============ Countdown Module ============ */
const countdown={
  render(){
    const list=[...store.countdowns].sort((a,b)=>a.date.localeCompare(b.date));
    const el=document.getElementById('cdGrid');
    if(list.length===0){el.innerHTML='<div class="card card-pad empty" style="grid-column:1/-1">暂无倒计时，点击「添加倒计时」开始</div>';return}
    const colors=['var(--primary)','var(--accent)','var(--success)','var(--info)','var(--danger)','#8b5cf6'];
    el.innerHTML=list.map((c,i)=>{
      const days=Math.ceil((new Date(c.date)-new Date(todayStr()))/86400000);
      const passed=days<0;
      return `<div class="cd-card">
        <div class="glow" style="background:${colors[i%colors.length]}"></div>
        <div class="cd-title">${c.title}</div>
        <div class="cd-sub">${c.date} ${c.desc?'· '+c.desc:''}</div>
        <div class="cd-days" style="color:${passed?'var(--muted)':colors[i%colors.length]}">${passed?Math.abs(days):days}<small> 天${passed?'（已过）':''}</small></div>
        <div style="margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="countdown.del('${c.id}')">删除</button></div>
      </div>`;
    }).join('');
  },
  openModal(){
    openModal('添加倒计时',`
      <div style="display:grid;gap:12px">
        <div><label class="lbl">事件名称</label><input class="input" id="c_title" placeholder="如：期末考试"></div>
        <div><label class="lbl">日期</label><input type="date" class="input" id="c_date"></div>
        <div><label class="lbl">备注（可选）</label><input class="input" id="c_desc"></div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="countdown.save()">保存</button>`);
  },
  save(){
    const data={title:document.getElementById('c_title').value.trim(),date:document.getElementById('c_date').value,desc:document.getElementById('c_desc').value.trim()};
    if(!data.title||!data.date){toast('请填写名称和日期');return}
    store.countdowns.push({id:uid(),...data});save();closeModal();countdown.render();dashboard.render();toast('已添加');
  },
  del(id){store.countdowns=store.countdowns.filter(x=>x.id!==id);save();countdown.render();dashboard.render();toast('已删除')}
};

/* ============ Stats Module ============ */
const stats={
  render(){
    const th=chartTheme();
    // last 7 days task completion
    const days=[];const done=[];const created=[];
    for(let i=6;i>=0;i--){
      const d=new Date();d.setDate(d.getDate()-i);
      const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      days.push(`${d.getMonth()+1}/${d.getDate()}`);
      done.push(store.tasks.filter(t=>t.due===ds&&t.done).length);
      created.push(store.tasks.filter(t=>t.due===ds).length);
    }
    const c1=document.getElementById('chartTask');if(c1._chart)c1._chart.destroy();
    c1._chart=new Chart(c1,{type:'line',data:{labels:days,datasets:[
      {label:'已完成',data:done,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.15)',fill:true,tension:.3},
      {label:'总数',data:created,borderColor:'#6d5efc',backgroundColor:'rgba(109,94,252,.1)',fill:true,tension:.3}
    ]},options:{responsive:true,plugins:{legend:{labels:{color:th.muted}}},scales:{y:{beginAtZero:true,ticks:{color:th.muted},grid:{color:th.border}},x:{ticks:{color:th.muted},grid:{display:false}}}}});

    // focus time
    const focus=[];
    for(let i=6;i>=0;i--){
      const d=new Date();d.setDate(d.getDate()-i);
      const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      focus.push(store.pomoLog.filter(l=>l.date===ds).reduce((s,l)=>s+l.duration,0));
    }
    const c2=document.getElementById('chartFocus');if(c2._chart)c2._chart.destroy();
    c2._chart=new Chart(c2,{type:'bar',data:{labels:days,datasets:[{label:'分钟',data:focus,backgroundColor:'#f59e0b',borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{color:th.muted},grid:{color:th.border}},x:{ticks:{color:th.muted},grid:{display:false}}}}});

    // category pie
    const cats={};store.tasks.forEach(t=>cats[t.category]=(cats[t.category]||0)+1);
    const c3=document.getElementById('chartCat');if(c3._chart)c3._chart.destroy();
    c3._chart=new Chart(c3,{type:'doughnut',data:{labels:Object.keys(cats).length?Object.keys(cats):['暂无'],datasets:[{data:Object.keys(cats).length?Object.values(cats):[1],backgroundColor:['#6d5efc','#f59e0b','#10b981','#06b6d4','#8b5cf6','#ef4444']}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{color:th.muted}}}}});

    // priority
    const pri={high:0,mid:0,low:0};store.tasks.forEach(t=>{if(pri[t.priority]!==undefined)pri[t.priority]++});
    const c4=document.getElementById('chartPri');if(c4._chart)c4._chart.destroy();
    c4._chart=new Chart(c4,{type:'polarArea',data:{labels:['高','中','低'],datasets:[{data:[pri.high,pri.mid,pri.low],backgroundColor:['#ef4444','#f59e0b','#10b981']}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{color:th.muted}}},scales:{r:{ticks:{display:false},grid:{color:th.border}}}}});
  }
};

/* ============ Dashboard Module ============ */
const dashboard={
  render(){
    const today=todayStr();
    const todays=store.tasks.filter(t=>t.due===today);
    const done=store.tasks.filter(t=>t.done).length;
    const total=store.tasks.length;
    document.getElementById('statToday').textContent=todays.filter(t=>!t.done).length;
    document.getElementById('statDone').textContent=done;
    document.getElementById('statRate').textContent=total?Math.round(done/total*100):0;
    const weekAgo=new Date();weekAgo.setDate(weekAgo.getDate()-7);
    const weekFocus=store.pomoLog.filter(l=>new Date(l.ts)>=weekAgo).reduce((s,l)=>s+l.duration,0);
    document.getElementById('statFocus').innerHTML=`${weekFocus}<span style="font-size:14px;color:var(--muted);font-weight:600"> 分钟</span>`;
    document.getElementById('statTomato').textContent=store.pomoLog.filter(l=>new Date(l.ts)>=weekAgo).length;
    document.getElementById('statCourse').textContent=store.schedule.filter(s=>s.day===new Date().getDay()).length;
    document.getElementById('taskCount').textContent=todays.filter(t=>!t.done).length;

    // today tasks
    const dt=document.getElementById('dashTasks');
    if(todays.length===0){dt.innerHTML='<div style="color:var(--muted);text-align:center;padding:16px;font-size:13px">今天没有任务，好好休息 🌿</div>'}
    else{dt.innerHTML=todays.slice(0,5).map(t=>`
      <div class="task-item" style="margin-bottom:6px">
        <div class="check ${t.done?'checked':''}" onclick="tasks.toggle('${t.id}');dashboard.render()">${t.done?'✓':''}</div>
        <div class="task-body"><div class="task-title ${t.done?'':''}">${t.title}</div>
        <div class="task-meta"><span class="tag tag-cat">${t.category}</span></div></div>
      </div>`).join('')}

    // today courses
    const dc=document.getElementById('dashCourses');
    const dayCourses=store.schedule.filter(s=>s.day===new Date().getDay()).sort((a,b)=>a.period-b.period);
    if(dayCourses.length===0){dc.innerHTML='<div style="color:var(--muted);text-align:center;padding:16px;font-size:13px">今天没有课程</div>'}
    else{dc.innerHTML=dayCourses.map(c=>`
      <div class="task-item" style="margin-bottom:6px">
        <div class="task-body"><div class="task-title">第${c.period}节 · ${c.name}</div>
        <div class="task-meta">👨‍🏫 ${c.teacher||'—'} · 📍 ${c.location||'—'}</div></div>
      </div>`).join('')}

    // countdown
    const dcd=document.getElementById('dashCountdown');
    const upcoming=[...store.countdowns].filter(c=>new Date(c.date)>=new Date(today)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
    if(upcoming.length===0){dcd.innerHTML='<div style="color:var(--muted);text-align:center;padding:16px;font-size:13px">暂无倒计时</div>'}
    else{dcd.innerHTML=upcoming.map(c=>{const days=Math.ceil((new Date(c.date)-new Date(today))/86400000);return `
      <div class="task-item" style="margin-bottom:6px">
        <div class="task-body"><div class="task-title">${c.title}</div>
        <div class="task-meta">${c.date}</div></div>
        <div style="font-weight:800;color:var(--accent);font-size:18px">${days}<span style="font-size:11px;color:var(--muted)">天</span></div>
      </div>`}).join('')}

    // homework
    const dhw=document.getElementById('dashHomework');
    const pendingHw=store.homework.filter(h=>!homework.stat(h).allDone).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,5);
    if(pendingHw.length===0){dhw.innerHTML='<div style="color:var(--muted);text-align:center;padding:16px;font-size:13px">暂无待完成作业 🎉</div>'}
    else{dhw.innerHTML=pendingHw.map(h=>{const s=homework.stat(h);const overdue=h.due&&h.due<today;return `
      <div class="task-item" style="margin-bottom:6px">
        <div class="task-body"><div class="task-title">${esc(h.title)}</div>
        <div class="task-meta"><span class="tag tag-cat">${esc(h.subject||'未分类')}</span>${h.due?`<span>📅 ${fmtDate(h.due)}</span>`:''}</div>
        <div class="progress"><i style="width:${s.pct}%"></i></div></div>
        <div style="text-align:right">
          <div class="prog-text">${s.done}/${s.total}</div>
          ${overdue?'<span class="tag tag-high" style="margin-top:4px">逾期</span>':''}
        </div>
      </div>`}).join('')}

    // notices
    const dn=document.getElementById('dashNotices');
    const recentN=store.notices.slice(-3).reverse();
    if(recentN.length===0){dn.innerHTML='<div style="color:var(--muted);text-align:center;padding:16px;font-size:13px">暂无通知</div>'}
    else{dn.innerHTML=recentN.map(n=>`
      <div class="task-item" style="margin-bottom:6px">
        <div class="task-body"><div class="task-title">${n.title}</div>
        <div class="task-meta">🕒 ${fmtDateTime(n.createdAt)}</div></div>
        ${!n.read?'<span class="tag tag-high">新</span>':''}
      </div>`).join('')}
  }
};

/* ============ 初始化：不含任何初始数据；老师/家长端密码默认 123456 ============ */
function purgeDemoData(){
  const MD='zhixueyun_no_demo_v1';
  if(localStorage.getItem(MD)==='1')return;
  // 旧版本内置的演示数据标记 + 已知示例标题，命中即视为演示数据，一次性清空
  const sigs=['完成高等数学作业','准备英语演讲','社团招新会议','复习线性代数',
    '高等数学第三章习题','英语作文：My Dream','线性代数矩阵运算练习',
    '期末考试','英语四级','下周一期中考试安排','家长会通知'];
  const hit=(arr)=>(arr||[]).some(x=>x&&sigs.indexOf(x.title)>=0);
  const seeded=store._meta && +store._meta.updatedAt===0;
  if(seeded || hit(store.tasks) || hit(store.homework) || hit(store.notices) || hit(store.countdowns)){
    ['tasks','schedule','grades','notes','countdowns','pomoLog','homework','notices'].forEach(k=>store[k]=[]);
    store._meta=null;
    DB.set(DB.key,store);
  }
  localStorage.setItem(MD,'1');
}
function ensurePwdDefaults(){
  let changed=false;
  PROTECTED_ROLES.forEach(r=>{
    if(!store[r+'Pwd']){store[r+'Pwd']={hash:'default',at:0};changed=true}
  });
  if(changed)DB.set(DB.key,store);
}
purgeDemoData();
ensurePwdDefaults();

/* Init role UI */
document.getElementById('roleIcon').textContent=ROLE_META[currentRole].icon;
(function(){const rn=document.getElementById('roleName');if(rn)rn.textContent=ROLE_META[currentRole].name+'端'})();
document.title=ROLE_META[currentRole].name+'端 · 智学云 校园管理任务工作台';
applyRoleUI();

/* 注册所有模块渲染器 + 首次渲染 */
RENDERERS.push(
  ()=>tasks.render(),
  ()=>schedule.render(),
  ()=>calendar.render(),
  ()=>grades.render(),
  ()=>notes.render(),
  ()=>countdown.render(),
  ()=>dashboard.render(),
  ()=>homework.render(),
  ()=>notices.render(),
  ()=>pomodoro.renderLog(),
  ()=>{if(document.getElementById('view-stats').classList.contains('active'))stats.render()}
);
renderAll();
pomodoro.update();

/* 进入门：老师端 / 家长端需密码；学生端首次进入需登记姓名；家长端解锁后需选择学生 */
const gatedOut=checkLock();
if(currentRole==='parent'){
  if(gatedOut)auth._afterUnlock=()=>persona.parentGate();
  else persona.parentGate();
}else{
  persona.studentGate();
}

// keep greeting fresh hourly
setInterval(updateGreeting,3600000);
// keep countdown & dashboard fresh every minute
setInterval(()=>{countdown.render();dashboard.render();homework.render();notices.render()},60000);
