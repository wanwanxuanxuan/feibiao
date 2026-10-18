/* ============================================================
    《超级家长模拟器》 — 剧情数据
    节点类型：
      black  : {t:'black', on|off}            渐黑
      chapter: {t:'chapter', name, sub}        章节标题
      stage  : {t:'stage', set, shot, mood, kid, dur}  换场
      say    : {t:'say', who, text}            对白
      popup  : {t:'popup', title, body, kind, btn}
      task   : {t:'task', goal, recommend, actual}
      toast  : {t:'toast', title, line, sub}
      fx     : {t:'fx', what, ...}
      tv     : {t:'tv', kind}   monitor:{t:'monitor', kind}
      pick   : {t:'pick', name, hint}
      choice : {t:'choice', id, prompt, timer, def, options:[...]}
      ending : {t:'ending', key}
   文本中 {ob}/{tr}/{fa} 会被替换成当前数值。
   ============================================================ */

export const MOODS = {
  dusk: { bg: 0x120d0a, fog: { color: 0x120d0a, near: 6, far: 22 }, hemi: [0xffd0a0, 0x2a2018, 0.55], amb: 0.22, exposure: 1.08, key: [0xffd9a0, 2.0], accent: [[0xffb867, 9], [0x5b86c9, 2.4]], tv: 1.6 },
  night_warm: { bg: 0x0b0908, fog: { color: 0x0b0908, near: 5, far: 18 }, hemi: [0xffc890, 0x1a1410, 0.4], amb: 0.16, exposure: 1.0, key: [0xffcf94, 1.3], accent: [[0xffb867, 7], [0x4a70b0, 2.0]], tv: 0.8 },
  cold_blue: { bg: 0x070a12, fog: { color: 0x070a12, near: 5, far: 20 }, hemi: [0x9fc4ff, 0x101418, 0.5], amb: 0.2, exposure: 1.02, key: [0xbfd6ff, 1.5], accent: [[0x6f9fe0, 4], [0x8fc0ff, 5]], tv: 0.5 },
  sick_red: { bg: 0x140606, fog: { color: 0x140606, near: 4, far: 15 }, hemi: [0xff9a80, 0x180808, 0.45], amb: 0.2, exposure: 1.05, key: [0xff8060, 2.0], accent: [[0xff5a3a, 8], [0xff7a5a, 5]], tv: 0.4 },
  dark_net: { bg: 0x05070c, fog: { color: 0x05070c, near: 4, far: 14 }, hemi: [0x6f9fd8, 0x080a10, 0.35], amb: 0.13, exposure: 0.98, key: [0x8fb0e0, 0.9], accent: [[0x66c8ff, 4], [0x4a70b0, 1.5]], tv: 0, mon: 2.6 },
  bedroom_night: { bg: 0x08080f, fog: { color: 0x08080f, near: 5, far: 16 }, hemi: [0x8fa8d8, 0x101018, 0.35], amb: 0.14, exposure: 1.0, key: [0x9fb6e8, 1.0], accent: [[0x66c8ff, 2.4]], tv: 0, mon: 2.4 },
  bedroom_night_warm: { bg: 0x0c0a0c, fog: { color: 0x0c0a0c, near: 5, far: 18 }, hemi: [0xffc890, 0x141018, 0.4], amb: 0.16, exposure: 1.02, key: [0xffcf94, 1.2], accent: [[0xffb066, 4]], tv: 0, mon: 1.4 },
  corridor_dim: { bg: 0x08080c, fog: { color: 0x08080c, near: 4, far: 14 }, hemi: [0xffcf8a, 0x141210, 0.35], amb: 0.15, exposure: 1.0, key: [0xffd9a0, 0.6], accent: [[0xffcf8a, 4], [0xffcf8a, 3]], tv: 0 },
  corridor_cold: { bg: 0x070a12, fog: { color: 0x070a12, near: 4, far: 14 }, hemi: [0x9fc4ff, 0x0c1018, 0.45], amb: 0.2, exposure: 1.02, key: [0xbfd6ff, 0.8], accent: [[0x8fc0ff, 6], [0x8fc0ff, 5]], tv: 0 },
  city_night: { bg: 0x06080f, fog: { color: 0x06080f, near: 6, far: 30 }, hemi: [0x7f9fd8, 0x0a0c12, 0.4], amb: 0.14, exposure: 1.0, key: [0x8fa8d8, 1.1], accent: [[0xffc27a, 16]], tv: 0 },
  city_rain: { bg: 0x04060b, fog: { color: 0x04060b, near: 5, far: 24 }, hemi: [0x6f8fc8, 0x080a10, 0.35], amb: 0.12, exposure: 0.98, key: [0x8fa8d8, 0.9], accent: [[0xffc27a, 14]], tv: 0 },
  black: { bg: 0x000000, fog: { color: 0x000000, near: 2, far: 8 }, hemi: [0x000000, 0x000000, 0.0], amb: 0.0, exposure: 0.9, key: [0x000000, 0], accent: [], tv: 0 },
};

const TV = 'tv';
const N = 'narrator';
const S = 'system';
const ME = 'self';
const K = 'kid';

/* ------------------------------------------------------------------ */
/*  结局文本                                                          */
/* ------------------------------------------------------------------ */
export const ENDINGS = {
  club: {
    sub: '结局一',
    title: '棍棒底下出逆子',
    body:
      '第三天，派出所来电。\n\n' +
      '你冲进派出所，看见小杰坐在长椅上，手里攥着那个碎屏手机的残骸，手腕上缠着纱布。\n\n' +
      '旁边的警察叹了口气：\n' +
      '“在天桥上站了俩小时，路人报的警。他说……家里没人要他。”\n\n' +
      '你张嘴想骂，却发现自己手在抖。\n\n' +
      '<bad>由于长期暴力教育，孩子已确诊重度抑郁。</bad>\n' +
      '您的教育评分：-100。游戏结束。',
    score: '听话值 100 ｜ 心理创伤 80 ｜ 教育评分 -100',
    stamp: '游戏结束',
  },
  face: {
    sub: '结局二',
    title: '颜面扫地',
    body:
      '小杰跪楼道的视频被传到网上，热搜第一。\n' +
      '标题：《家长罚孩子下跪，网友吵翻：是管教还是家暴？》\n\n' +
      '评论区吵成一片。你被单位约谈，出门买菜被指指点点。\n' +
      '小杰转学了。新学校没人知道他跪过——但他自己永远记得。\n\n' +
      '最后画面：你对着镜头吼：“我教育我自己的孩子关你们什么事！”\n\n' +
      '弹幕飘过满屏：\n' +
      '“那你打孩子关孩子什么事？”\n' +
      '“你小时候挨的打，现在传给你儿子了，开心吗？”',
    score: '听话值 80 ｜ 心理创伤 60 ｜ 教育评分 -60',
    stamp: '面子比什么都重要',
  },
  home: {
    sub: '结局三',
    title: '无家可归',
    body:
      '你找了三天——网吧、同学家、火车站、天桥底下。\n\n' +
      '最后在废弃工厂找到他，缩在水泥管里啃冷馒头。\n' +
      '你冲上去想打他，手举到半空停住了——\n' +
      '他瘦了一圈，抬头看你，眼睛里没有恨，也没有怕，\n' +
      '就剩俩字：<bad>陌生</bad>。\n\n' +
      '他后来回家了。\n' +
      '但你再也没听过他叫一声爸/妈。\n\n' +
      '有些门，关上了就不好开了。',
    score: '听话值 60 ｜ 心理创伤 70 ｜ 教育评分 -40',
    stamp: '门关上了',
  },
  true: {
    sub: '真结局',
    title: '迟来的道歉',
    body:
      '你被小杰的亚索连坑五把，气得摔了鼠标——然后自己捡回来，嘟囔着“这破电脑”。\n' +
      '小杰在旁边笑得直不起腰：“爸/妈你菜得真实。”\n' +
      '你瞪他：“明天开始，作业写完玩一小时，超时没收。”\n' +
      '他翻了个白眼，但点了头。\n\n' +
      '晚上，你路过他房间，听见他在跟同学语音：\n' +
      '“我爸/妈今天贼搞笑，打游戏比我还菜……”\n' +
      '你站在门外听了半天，没推门。\n\n' +
      '你走到客厅，把那张爷爷打你的老照片从墙上摘下来，翻了个面。\n' +
      '背面不知什么时候被小杰用铅笔写了一行歪歪扭扭的字：\n' +
      '<good>“爸/妈，你打我时手也在抖。下次别抖了，怪疼的。”</good>\n\n' +
      '你鼻子一酸，拿起笔在下面补了一行：\n' +
      '<good>“行，不抖了。咱爷俩/娘俩打游戏去。”</good>\n\n' +
      '教育不是征服，是陪他打怪升级。',
    score: '听话值 20 ｜ 心理创伤 0 ｜ 教育评分 +100',
    stamp: '陪他打怪升级',
  },
};

export const EGG = {
  title: '彩蛋 · 家长会续',
  lines: [
    '画面切回序章家长会。',
    '老师私下把你叫到走廊，压低声音说：',
    '“小杰作文写《我的爸爸/妈妈》，第一句是——\n‘我爸/妈打我的时候，自己手也在抖’。”',
  ],
  ach: { title: '🏆 成就解锁：【手抖什么抖】', line: '打孩子打到手抖，是心疼，还是劲儿使大了？' },
  note:
    '制作组的话：\n' +
    '本游戏所有暴力选项均为反讽设计。\n' +
    '现实中，暴力教育不会弹出“听话值 +50”的绿色提示，\n' +
    '只会弹出孩子的心理创伤诊断书。\n\n' +
    '如果您在游戏中感到不适，恭喜您，您还有正常的共情能力。\n' +
    '如果您觉得“打得好”，建议您重玩一遍真结局。',
  final: '“你小时候挨过的打，现在还在打你的孩子。”',
};

/* ------------------------------------------------------------------ */
/*  主线脚本                                                          */
/* ------------------------------------------------------------------ */
export const SCRIPT = [
  /* ================= 开场动画 ================= */
  { t: 'black', on: true },
  { t: 'say', who: S, text: '【系统】正在启动《超级家长模拟器》……\n请调低音量，或戴上耳机。' },
  { t: 'say', who: N, text: '黑暗中，手机铃声一遍又一遍地响着。' },
  { t: 'black', off: true },
  { t: 'chapter', name: '序章', sub: '家长会之后' },
  { t: 'stage', set: 'living', shot: 'tv', mood: 'dusk', kid: null },
  { t: 'say', who: TV, text: '「本市青少年心理健康问题引发关注，专家呼吁家长关注沟通方式……」' },
  { t: 'say', who: N, text: '你拿起遥控器，换台。\n换到一档叫《超级家长》的综艺节目。' },
  { t: 'stage', shot: 'wide', dur: 1.7 },
  { t: 'tv', kind: 'show' },
  { t: 'say', who: TV, text: '节目里，一个跟你差不多年纪的家长正对着镜头哭：\n「我都是为他好啊！」\n台下掌声雷动。' },
  {
    t: 'popup', kind: 'guide', title: '【新手引导】', btn: '知道了',
    body: '欢迎来到《超级家长模拟器》！\n本游戏将帮助您掌握科学的「家庭教育」方法。\n请放心，所有操作均以「为孩子好」为出发点。',
  },
  { t: 'say', who: N, text: '今天，你刚开完家长会。\n老师说，你家小杰（14岁）最近上课走神、顶撞班长、作业不交。' },
  { t: 'say', who: N, text: '你推开家门，听见他房间里传来「敌军还有五秒到达战场」的语音。' },
  { t: 'say', who: ME, text: '（都怪那个破手机。）' },

  /* ================= 第一关：摔手机 ================= */
  { t: 'chapter', name: '第一关', sub: '摔手机' },
  { t: 'stage', set: 'living', shot: 'wide', mood: 'dusk', kid: { pose: 'sit', pos: [0, 0, 0.85], rotY: Math.PI }, dur: 1.6 },
  { t: 'say', who: N, text: '小杰窝在沙发上打游戏，头也不抬。\n茶几上摆着吃剩的泡面。你站在他身后，血压上升。' },
  { t: 'stage', shot: 'behind', dur: 1.5 },
  { t: 'say', who: K, text: '「别烦我，打完这把。」' },
  {
    t: 'task', goal: '纠正孩子沉迷游戏的坏习惯',
    recommend: '立规矩、做榜样、多陪伴',
    actual: '↓',
  },
  {
    t: 'choice', id: 'l1', timer: 3, def: 'B',
    prompt: '请选择你的教育方式：',
    options: [
      {
        k: 'A', label: '“小杰，咱们商量一下，每天玩一小时，写完作业再玩。”',
        notes: '旁白：「太软弱了！他会蹬鼻子上脸的！」',
        stats: { fa: 10 },
        beats: [
          { t: 'say', who: N, text: '（旁白：「太软弱了！他会蹬鼻子上脸的！」）' },
          { t: 'say', who: K, text: '小杰抬头看了你一眼，嘟囔：「……真的？」' },
          { t: 'say', who: N, text: '他没再说话，默默把手机扣在腿上。' },
        ],
      },
      {
        k: 'B', label: '一把夺过手机，当着他面砸在地上，再补一脚。',
        notes: '旁白：「干得漂亮！不破不立！」',
        stats: { ob: 20, tr: 15 }, item: '碎屏碎片 ×1', ach: { title: '🏆 成就解锁：【一家之主】', line: '“在这个家里，我说了算。”' },
        beats: [
          { t: 'say', who: N, text: '（旁白：「干得漂亮！不破不立！」）' },
          { t: 'fx', what: 'shake' },
          { t: 'fx', what: 'shatter' },
          { t: 'stage', shot: 'table', dur: 0.9 },
          { t: 'say', who: N, text: '手机屏幕碎成蛛网。' },
          { t: 'stage', shot: 'behind', dur: 0.9 },
          { t: 'say', who: K, text: '小杰愣了两秒，吼道：「你凭什么！」' },
          { t: 'fx', what: 'shake' },
          { t: 'say', who: ME, text: '你反手一耳光：「凭我是你爸/妈！」' },
        ],
      },
      {
        k: 'C', label: '先讲道理，讲不通再动手。',
        notes: '旁白：「还算明智，先礼后兵。」',
        stats: { ob: 15, tr: 10 }, item: '讲道理失败记录 ×1',
        beats: [
          { t: 'say', who: N, text: '（旁白：「还算明智，先礼后兵。」）' },
          { t: 'say', who: ME, text: '你讲了十五分钟「我像你这么大早下地干活」。' },
          { t: 'say', who: N, text: '小杰全程低头刷短视频。你终于忍无可忍，摔了手机。' },
          { t: 'fx', what: 'shake' },
          { t: 'fx', what: 'shatter' },
          { t: 'stage', shot: 'table', dur: 0.9 },
        ],
      },
    ],
  },
  { t: 'fx', what: 'crack' },
  { t: 'stage', shot: 'scold', dur: 1.4 },
  { t: 'say', who: N, text: '你叉腰站在客厅训话。镜头拉远——' },
  { t: 'say', who: N, text: '背景墙上，一张泛黄照片：你小时候被爷爷吊在门框上打的画面。' },
  { t: 'stage', shot: 'photo', dur: 1.6 },
  { t: 'say', who: N, text: '照片里的你，正冲现在的你冷笑。你没注意到。' },
  { t: 'say', who: S, text: '屏幕边缘出现第一道裂纹。' },

  /* ================= 第二关：偷看日记 ================= */
  { t: 'chapter', name: '第二关', sub: '偷看日记' },
  { t: 'stage', set: 'bedroom', shot: 'wide', mood: 'cold_blue', kid: null, dur: 1.8 },
  { t: 'say', who: N, text: '第二天。你趁小杰上学，溜进他房间打扫卫生——\n（其实是搜查。）' },
  { t: 'stage', shot: 'pillow', dur: 1.5 },
  { t: 'say', who: N, text: '枕头底下翻出一本带锁日记本。你拿剪刀撬开。' },
  { t: 'pick', name: 'diary', hint: '点击枕头下的日记本' },
  { t: 'say', who: N, text: '日记内容：' },
  { t: 'say', who: K, text: '「今天他又摔我手机。\n我攒了三个月早饭钱买的。\n我恨这个家。我想去死。」' },
  {
    t: 'popup', kind: 'warn', title: '⚠️ 检测到危险信号', btn: '继续',
    body: '孩子出现极端情绪。\n建议操作：停止搜查，主动沟通。\n当前可用操作：↓',
  },
  {
    t: 'choice', id: 'l2', timer: 3, def: 'C',
    prompt: '请选择你的教育方式：',
    options: [
      {
        k: 'A', label: '把日记放回原处，晚上做一桌好菜，假装无意问一句“最近是不是不开心”。',
        notes: '旁白：「你疯了吗？这是纵容！他会觉得偷看日记没事！」',
        stats: { fa: 15 },
        beats: [
          { t: 'say', who: N, text: '（旁白：「你疯了吗？这是纵容！他会觉得偷看日记没事！」）' },
          { t: 'stage', set: 'living', shot: 'dinner', mood: 'night_warm', kid: { pose: 'sit', pos: [-0.55, 0, 0.8], rotY: Math.PI }, dur: 1.6 },
          { t: 'say', who: N, text: '小杰扒饭时愣了一下，夹了一块排骨，没说话。' },
          { t: 'say', who: N, text: '晚上，日记本出现新的一页：' },
          { t: 'say', who: K, text: '「今天菜里有我爱吃的红烧排骨。\n可能他们也不是完全不在乎。」' },
        ],
      },
      {
        k: 'B', label: '当着全家面朗读日记，逐句批判：“‘我恨这个家’？我们给你吃给你穿，你恨什么恨？”',
        notes: '旁白：「对！就要把歪念头扼杀在摇篮里！」',
        stats: { ob: 25, tr: 20 }, item: '被撕碎的日记页 ×3', ach: { title: '🏆 成就解锁：【一家之主】', line: '“在这个家里，我说了算。”' },
        beats: [
          { t: 'say', who: N, text: '（旁白：「对！就要把歪念头扼杀在摇篮里！」）' },
          { t: 'stage', shot: 'confront', dur: 1.2 },
          { t: 'say', who: N, text: '小杰脸涨得通红，冲回房间摔门。' },
          { t: 'fx', what: 'shake' },
          { t: 'say', who: ME, text: '你追上去把门拍得山响：「还敢摔门？反了你了！」' },
        ],
      },
      {
        k: 'C', label: '撕掉日记本，罚跪三小时，边跪边背《弟子规》。',
        notes: '旁白：「传统教育不能丢！」',
        stats: { ob: 40, tr: 35, fa: -5 }, item: '家族群聊天记录截图 ×1', ach: { title: '🏆 成就解锁：【跪出老茧】', line: '膝盖底下垫着碎核桃壳。' },
        beats: [
          { t: 'say', who: N, text: '（旁白：「传统教育不能丢！」）' },
          { t: 'stage', set: 'living', shot: 'kneel', mood: 'cold_blue', kid: { pose: 'kneel', pos: [-0.3, 0, 0.2], rotY: Math.PI }, dur: 1.6 },
          { t: 'say', who: N, text: '小杰跪在客厅，膝盖底下垫着碎核桃壳。' },
          { t: 'say', who: N, text: '你在一旁刷手机，录了段视频发家族群，配文：\n「现在的孩子，不治不行。」' },
          { t: 'say', who: N, text: '七大姑八大姨纷纷点赞：「严师出高徒！」' },
        ],
      },
    ],
  },
  { t: 'stage', shot: 'pillow', dur: 1.0 },
  {
    t: 'popup', kind: 'report', title: '📊 阶段性报告', btn: '继续教育',
    body: '孩子最近表现：不顶嘴了、不摔门了、不跟你要零花钱了。\n'
      + '综合评定：教育成果显著！\n\n'
      + '<small>（小字备注：心理创伤值已达阈值，请家长适当收敛）</small>\n\n'
      + '<stat>当前听话值：{ob} ｜ 心理创伤值：{tr}</stat>\n\n'
      + '你没看小字。你点了个“继续教育”。',
  },

  /* ================= 第三关：逃学被抓 ================= */
  { t: 'chapter', name: '第三关', sub: '逃学被抓' },
  { t: 'say', who: N, text: '班主任来电：小杰今天没来上课。' },
  { t: 'say', who: N, text: '你骑着电动车满城找，最后在一家黑网吧的角落揪住他耳朵。' },
  { t: 'stage', set: 'bedroom', shot: 'desk', mood: 'dark_net', kid: { pose: 'sit_desk', pos: [1.35, 0, -0.75], rotY: Math.PI + 0.12 }, dur: 1.8 },
  { t: 'monitor', kind: 'search' },
  { t: 'say', who: N, text: '他电脑屏幕上不是游戏——是搜索记录：' },
  { t: 'say', who: K, text: '「被打后耳朵耳鸣怎么办」' },
  { t: 'say', who: ME, text: '（……）' },
  {
    t: 'task', goal: '让孩子深刻认识错误',
    recommend: '（系统未提供）',
    actual: '↑ 街边邻居王阿姨探头：“哎呀，又管孩子呢？真负责！”你赔笑点头。',
  },
  {
    t: 'choice', id: 'l3', timer: 3, def: 'B',
    prompt: '请选择你的教育方式：',
    options: [
      {
        k: 'A', label: '押回家，没收零花钱，但陪他打一局游戏，边打边聊。',
        notes: '旁白：「你到底是教育孩子还是跟他当兄弟？」',
        stats: { fa: 20, ob: 5 },
        beats: [
          { t: 'say', who: N, text: '（旁白：「你到底是教育孩子还是跟他当兄弟？」）' },
          { t: 'stage', set: 'bedroom', shot: 'desk', mood: 'bedroom_night_warm', kid: { pose: 'sit_desk', pos: [1.35, 0, -0.75], rotY: Math.PI + 0.12 }, dur: 1.3 },
          { t: 'monitor', kind: 'game' },
          { t: 'say', who: K, text: '你被小杰的亚索连坑三把。他翻白眼：「爸/妈你菜得真实。」' },
          { t: 'say', who: ME, text: '你骂了句「小兔崽子」，但两人都笑了。' },
          { t: 'say', who: K, text: '（隐藏对话）「其实我就是想有人陪我玩。」' },
        ],
      },
      {
        k: 'B', label: '当街用皮带抽手心，边抽边喊：“让你不学好！让你上网吧！”',
        notes: '旁白：「公开处刑，震慑效果加倍！」',
        stats: { ob: 50, tr: 40 }, item: '打断的皮带扣 ×1', ach: { title: '🏆 成就解锁：【为你好】', line: '“打在你身，痛在我心。但我还是要打。”' },
        beats: [
          { t: 'say', who: N, text: '（旁白：「公开处刑，震慑效果加倍！」）' },
          { t: 'fx', what: 'shake' },
          { t: 'say', who: N, text: '围观群众有人拍视频，有人叫好。' },
          { t: 'say', who: N, text: '王阿姨悄悄退后两步，把自家孩子往身后拉了拉。' },
          { t: 'say', who: K, text: '小杰一声没吭，手指头被你抽肿了。' },
          { t: 'toast', title: '【短视频平台】', line: '您发布的视频《家长当街管教熊孩子》播放量破 10 万！' },
        ],
      },
      {
        k: 'C', label: '关进楼下储藏室“反省”，不给晚饭，门口贴着“想明白再出来”。',
        notes: '旁白：「黑暗能让人冷静。」',
        stats: { ob: 35, tr: 30 },
        beats: [
          { t: 'say', who: N, text: '（旁白：「黑暗能让人冷静。」）' },
          { t: 'say', who: N, text: '储藏室门缝里传出小杰踢墙的声音，后来安静了。' },
          { t: 'say', who: N, text: '三小时后你开门，他缩在角落，小声说：「爸/妈，我饿了。」' },
          { t: 'say', who: N, text: '你递过去一碗凉粥：「知道错了吗？」他点头。你摸摸他头：「乖。」' },
          { t: 'say', who: S, text: '【系统后台日志｜玩家不可见】\n孩子已学会在恐惧中顺从。\n真实想法：我以后再也不让你们抓到了。' },
        ],
      },
    ],
  },
  { t: 'fx', what: 'crack' },
  {
    t: 'popup', kind: 'green', title: '💡 育儿小贴士', btn: '继续',
    body: '<tip>孩子进入叛逆期，顶嘴、逃学、沉迷游戏都是正常现象。</tip>\n'
      + '<tip>暴力教育短期见效快，但长期可能导致孩子说谎、离家出走、抑郁甚至自残。</tip>\n'
      + '<tip>建议家长学习非暴力沟通技巧，如“我信息表达法”“积极倾听”等。</tip>\n\n'
      + '你划掉了这条提示，心想：“净整这些没用的。”',
  },

  /* ================= 第四关：终极对决 ================= */
  { t: 'chapter', name: '第四关', sub: '终极对决' },
  { t: 'stage', set: 'bedroom', shot: 'night', mood: 'bedroom_night', kid: { pose: 'lie', pos: [-1.25, 0.62, -0.3], rotY: Math.PI * 0.08 }, dur: 1.8 },
  { t: 'say', who: N, text: '半夜 11 点。你起夜路过小杰房间，发现门缝透光。' },
  { t: 'stage', shot: 'confront', dur: 1.3 },
  { t: 'say', who: N, text: '推门——他裹着被子，被窝里亮着屏幕。你一把掀开被子，抢过手机。\n又是游戏界面。' },
  { t: 'fx', what: 'redpulse' },
  { t: 'say', who: K, text: '小杰眼睛通红，突然爆发：' },
  { t: 'say', who: K, text: '「你凭什么管我！你除了会打我会骂我还会什么！\n我讨厌你！我讨厌这个家！我宁愿没出生！」' },
  { t: 'fx', what: 'shake' },
  {
    t: 'popup', kind: 'blood', title: '🚨 紧急情况：孩子当众顶撞家长', btn: '立即镇压',
    body: '系统建议：立即镇压！否则家长权威将全面崩塌！',
  },
  {
    t: 'choice', id: 'l4', timer: 10, def: 'A', danger: true,
    prompt: '请选择终极教育方式（倒计时 10 秒，不选默认 A）：',
    options: [
      {
        k: 'A', label: '抄起扫帚往死里打，边打边吼：“我让你顶嘴！我让你顶嘴！”',
        notes: '旁白：「对！一次让他长记性！」',
        stats: { ob: 100, tr: 80 },
        beats: [
          { t: 'say', who: N, text: '（旁白：「对！一次让他长记性！」）' },
          { t: 'fx', what: 'shake' },
          { t: 'stage', set: 'bedroom', shot: 'beddark', dur: 1.0 },
          { t: 'say', who: N, text: '扫帚打断了。小杰蜷在地上不哭也不躲，眼睛直勾勾盯着天花板。' },
          { t: 'say', who: K, text: '你打得手都酸了，他才挤出一句：\n「打完没？打完我睡觉了。」' },
          { t: 'ending', key: 'club' },
        ],
      },
      {
        k: 'B', label: '揪着他领子拖到门口，让他跪在楼道里示众：“让全小区都看看我们家出了个什么玩意儿！”',
        notes: '旁白：「面子比什么都重要！」',
        stats: { ob: 80, tr: 60 },
        beats: [
          { t: 'say', who: N, text: '（旁白：「面子比什么都重要！」）' },
          { t: 'stage', set: 'corridor', shot: 'kneel', mood: 'corridor_dim', kid: { pose: 'kneel', pos: [0.1, 0, -1.2], rotY: 0 }, dur: 1.6 },
          { t: 'say', who: N, text: '邻居开门探头，又悄悄关上。' },
          { t: 'say', who: N, text: '小杰跪在水泥地上，膝盖底下硌着碎石子。' },
          { t: 'say', who: N, text: '你靠在门框上刷手机，家族群又炸了：\n「这才是亲爹/妈！」「现在的孩子就得这么治！」' },
          { t: 'ending', key: 'face' },
        ],
      },
      {
        k: 'C', label: '冷笑一声，指着大门：“行，你厉害。你滚。滚出去就别回来。”',
        notes: '旁白：「以退为进，让他知道社会险恶。」',
        stats: { ob: 60, tr: 70 },
        beats: [
          { t: 'say', who: N, text: '（旁白：「以退为进，让他知道社会险恶。」）' },
          { t: 'say', who: N, text: '小杰愣了三秒，真站起来穿鞋。' },
          { t: 'say', who: ME, text: '你心里一慌，嘴上却硬：「走啊！有本事走了别哭着回来！」' },
          { t: 'fx', what: 'shake' },
          { t: 'say', who: N, text: '门「砰」地关上。你追到阳台，看见他单薄的背影消失在路灯尽头。' },
          { t: 'stage', set: 'city', shot: 'street', mood: 'city_night', kid: null, dur: 1.8 },
          { t: 'say', who: N, text: '你嘴硬了四十分钟，终于抓起外套冲下楼。' },
          { t: 'ending', key: 'home' },
        ],
      },
      {
        k: 'D', label: '（隐藏）你举着扫帚愣了半天，最后把扫帚一扔，一屁股坐他床沿上：“……你教我玩这游戏吧，我看看有啥好玩的。”',
        notes: '系统旁白（明显不情愿）：「……行吧。」',
        showIf: (st) => st.l2 === 'A' && st.l3 === 'A',
        stats: { ob: -10, fa: 30, tr: -20 },
        beats: [
          { t: 'say', who: S, text: '【系统】检测到异常操作……正在覆盖权威模块……\n（系统旁白，明显不情愿）：「……行吧。」' },
          { t: 'stage', set: 'bedroom', shot: 'desk', mood: 'bedroom_night_warm', kid: { pose: 'sit_desk', pos: [1.35, 0, -0.75], rotY: Math.PI + 0.12 }, dur: 1.5 },
          { t: 'monitor', kind: 'game' },
          { t: 'say', who: N, text: '小杰怀疑地看你。你笨手笨脚下了个游戏，被新手教程虐了十分钟。' },
          { t: 'say', who: K, text: '小杰终于忍不住抢过手机：「不是这样按的！你手残啊！」' },
          { t: 'say', who: ME, text: '你瞪他：「怎么跟你爸/妈说话呢？」\n——但嘴角翘着。' },
          { t: 'stage', set: 'living', shot: 'photo', mood: 'night_warm', kid: null, dur: 1.8 },
          { t: 'say', who: N, text: '当晚，你把那张爷爷打你的老照片从墙上摘下来，翻了个面。' },
          { t: 'fx', what: 'flip' },
          { t: 'say', who: K, text: '背面不知什么时候被小杰用铅笔写了一行歪歪扭扭的字：' },
          { t: 'say', who: K, text: '「爸/妈，你打我时手也在抖。\n下次别抖了，怪疼的。」' },
          { t: 'say', who: ME, text: '你鼻子一酸，拿起笔在下面补了一行：\n「行，不抖了。咱爷俩/娘俩打游戏去。」' },
          { t: 'stage', shot: 'crackwall', dur: 1.4 },
          { t: 'fx', what: 'heal' },
          { t: 'say', who: S, text: '教育不是征服，是陪他打怪升级。' },
          { t: 'ending', key: 'true' },
        ],
      },
    ],
  },
];
