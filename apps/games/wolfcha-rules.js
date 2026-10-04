// Shared by the help UI and the AI game instructions. The linked article is reference material.
const WOLFCHA_RULES = Object.freeze({
    source: 'https://langrensha.ijinshan.com/pages/guide/rules/index.html',
    sections: [
        ['玩法流程', '夜间各身份依次行动，白天公布夜间结算后讨论、放逐，再入夜。标准局首日可竞选警长：警长票重 1.5，并决定发言方向；放逐平票时进行 PK 发言和重投。'],
        ['夜间顺序', '参考规则：守卫 → 狼人 → 女巫 → 预言家。守卫不能连续两夜守同一人；狼人共同选目标；女巫解药、毒药各一瓶，同夜不能同时使用；预言家每夜查验一人的阵营。'],
        ['身份与出局', '村民靠发言与票型找狼。猎人被刀或被放逐可开枪，被毒不能开枪。进阶身份：白痴被放逐亮牌免死但失去投票权；白狼王可白天自爆带走一人。'],
        ['胜负条件', '好人找出全部狼人获胜。屠边：狼人使神职或村民其中一类全部出局；屠城：狼人使全部好人出局。开局应先约定模式，不能中途混用。'],
        ['常用术语', '金水＝预言家查验为好人；查杀＝查验为狼人；银水＝女巫救过的人。悍跳＝冒充神职；自刀＝狼刀自己；归票＝号召投同一目标；自爆＝白天亮狼牌出局并转入夜。']
    ],
    currentMode: '本局是 2–10 人的角色陪玩模式：按席位依次发言，由你选择放逐对象；夜间仅引导流程。尚未结算夜间技能、警长竞选、多人票型、PK 和自动胜负，不得把引导台词当作实际结果。白痴、白狼王仅供规则学习，不在当前身份池内。',
    nightSteps: [
        { key: 'guard', role: '守卫', text: '守卫请睁眼。本局仅作流程引导，守护目标不能连续两夜相同。' },
        { key: 'werewolf', role: '狼人', text: '狼人请睁眼，确认同阵营。标准局共同选择狼刀目标，本局暂不结算狼刀。' },
        { key: 'witch', role: '女巫', text: '女巫请睁眼。解药和毒药各限一次，同夜不能同时使用；本局暂不结算用药。' },
        { key: 'seer', role: '预言家', text: '预言家请睁眼。标准局查验一人的阵营，本局暂不提供实际查验结果。' }
    ]
});

function getWolfchaRolePool(count) {
    const total = Math.max(2, Math.min(10, Math.floor(Number(count) || 2)));
    const wolves = total >= 9 ? 3 : total >= 6 ? 2 : 1;
    const gods = ['预言家', '女巫', '猎人', '守卫'].slice(0, Math.min(4, total - wolves - 1));
    return [...Array(wolves).fill('狼人'), ...gods, ...Array(total - wolves - gods.length).fill('村民')];
}

function getWolfchaConfigurationText(state) {
    const counts = new Map();
    (state?.players || []).forEach(player => counts.set(player.role || '村民', (counts.get(player.role || '村民') || 0) + 1));
    return [...counts].map(([role, count]) => `${role} ${count} 位`).join('、');
}

function getWolfchaRulesPrompt(state) {
    return `【规则与裁判约束】\n${WOLFCHA_RULES.sections.map(([title, text]) => `${title}：${text}`).join('\n')}\n本局公开身份配置：${getWolfchaConfigurationText(state)}。仅公布数量，不公布身份对应的席位。\n${WOLFCHA_RULES.currentMode}\n裁判负责控制阶段和公开已结算的信息；玩家不得代替裁判宣布技能、票数或胜负。发言属于玩家陈述，可能撒谎，不可视为裁判确认。`;
}

function getWolfchaNightSteps(state) {
    const roles = new Set((state?.players || []).filter(player => player.alive !== false).map(player => player.role));
    return WOLFCHA_RULES.nightSteps.filter(step => roles.has(step.role));
}

function renderWolfchaRules(state = null) {
    return `<details class="wolfcha-help wolfcha-rules"><summary>规则与玩法</summary>
        <p>${musicEscapeHtml(WOLFCHA_RULES.currentMode)}</p>
        ${state ? `<p>本局身份配置：${musicEscapeHtml(getWolfchaConfigurationText(state))}。</p>` : '<p>邀请 1–9 位角色，你自动入席。身份配置随人数调整，至少有一名狼人和一名村民，具体配置在开局后公开。</p>'}
        ${WOLFCHA_RULES.sections.map(([title, text]) => `<p><strong>${musicEscapeHtml(title)}</strong><br>${musicEscapeHtml(text)}</p>`).join('')}
        <p>你的身份仅自己可见；狼人可见狼队友。AI 发言遵循以上规则与角色人设，轮到你时输入发言。<a href="${WOLFCHA_RULES.source}" target="_blank" rel="noopener noreferrer">查看参考规则</a></p>
    </details>`;
}
