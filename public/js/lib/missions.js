// Missões e conquistas: what the family still has to do to get the most of the app (missions) and what it already
// achieved (selos). Missions are done by themselves when the data shows it; nothing to tick. Pure, tested in
// tests/lib.test.mjs. Names ("Missões", "Conquistas") are provisional: they live only in these texts.

/*
  facts: { hasCard, hasConta, hasClosedMonth (a month with statement), pending (entries to check in it), goalsSet,
    pushOn, closedCount, dream, invest, debts, fixas, members, manualAny, installed, skips: { key: true } }
*/
export function missionList(f = {}) {
  const sk = f.skips || {};
  return [
    // The 6 starter missions, in order: they make the app show the family's real month.
    { key: 'fatura', starter: true, done: !!f.hasCard, title: 'Mande a última fatura do cartão', hint: 'O PDF que o app do banco gera.', unlocks: 'para onde foi o dinheiro do cartão', go: ['lancar', '#drop'], btn: 'Mandar' },
    { key: 'extrato', starter: true, done: !!f.hasConta, title: 'Mande o extrato da conta', hint: 'O mês inteiro, do dia 1 ao último dia.', unlocks: 'a sobra de verdade do mês', go: ['lancar', '#drop'], btn: 'Mandar' },
    { key: 'conferir', starter: true, done: !!f.hasClosedMonth && !f.pending, title: 'Confira os lançamentos marcados', hint: 'O app sugeriu a categoria e quer a sua confirmação.', unlocks: 'gráficos certos e um app que aprende', go: ['extrato', '#lPend'], btn: 'Conferir' },
    { key: 'metas', starter: true, done: !!f.goalsSet, title: 'Combine quanto guardar', hint: 'A meta de vocês e o limite do cartão.', unlocks: 'avisos de gasto e a previsão do mês', go: ['ajustes', '#gSav', 'metas'], btn: 'Combinar' },
    { key: 'avisos', starter: true, done: !!f.pushOn, skip: 'Não quero', title: 'Ligue os avisos no celular', hint: 'Fatura fechou, mês acabando, gasto alto.', unlocks: 'o app lembra vocês na hora certa', go: ['ajustes', '#pushBox', 'avisos'], btn: 'Ligar' },
    { key: 'fechar', starter: true, done: (+f.closedCount || 0) > 0, title: 'Feche o primeiro mês', hint: 'Confira o que falta e veja a retrospectiva.', unlocks: 'a retrospectiva e o nível do ano', go: ['fechar'], btn: 'Fechar' },
    // Extra missions: the rest of the app.
    { key: 'sonho', done: !!f.dream, title: 'Defina o sonho de vocês', hint: 'Quanto querem ter investido e com que idade.', unlocks: 'quando vocês chegam lá', go: ['ajustes', '#gPat', 'metas'], btn: 'Definir' },
    { key: 'convite', done: (+f.members || 0) > 1, skip: 'Uso sozinho', title: 'Convide quem divide as contas', hint: 'Um link pelo WhatsApp.', unlocks: 'a família toda no mesmo lugar', go: ['ajustes', '#ivName', 'familia'], btn: 'Convidar' },
    { key: 'falar', done: !!f.manualAny, title: 'Lance um gasto falando', hint: 'Ex.: "gastei 45 na padaria no pix".', unlocks: 'o mês em dia antes do extrato', go: ['lancar', '#qText'], btn: 'Lançar' },
    { key: 'fixas', done: !!f.fixas, skip: 'Não tenho', title: 'Liste as contas fixas do cartão', hint: 'Assinaturas, seguros, planos.', unlocks: 'a previsão da próxima fatura', go: ['ajustes', '[data-add="recurring"]', 'patrimonio'], btn: 'Listar' },
    { key: 'invest', done: !!f.invest, skip: 'Ainda não tenho', title: 'Informe investimentos e bens', hint: 'Valor investido hoje, imóveis e veículos.', unlocks: 'o patrimônio da família', go: ['ajustes', '#iTotal', 'patrimonio'], btn: 'Informar' },
    { key: 'dividas', done: !!f.debts, skip: 'Não tenho', title: 'Cadastre financiamentos e dívidas', hint: 'Saldo, taxa e parcela.', unlocks: 'o saldo que diminui sozinho', go: ['ajustes', '[data-add="debts"]', 'patrimonio'], btn: 'Cadastrar' },
    { key: 'instalar', done: !!f.installed, title: 'Instale o app no celular', hint: 'Ícone na tela, abre em tela cheia.', unlocks: 'acesso em um toque', install: true, btn: 'Como?' },
  ].map(m => ({ ...m, skipped: !m.done && !!m.skip && !!sk[m.key] }));
}

export const missionProgress = list => {
  const ok = m => m.done || m.skipped, st = list.filter(m => m.starter), ex = list.filter(m => !m.starter);
  return { starterDone: st.filter(ok).length, starterTotal: st.length, starterComplete: st.every(ok), next: st.find(m => !ok(m)) || ex.find(m => !ok(m)) || null,
    extraDone: ex.filter(ok).length, extraTotal: ex.length, allComplete: list.every(ok) };
};

// Which missions just got done (to celebrate once). prev: households.settings.missionsDone ({ key: 'AAAA-MM-DD' }),
// undefined for a family that never had missions: then everything already done is recorded silently.
export function syncMissions(prev, list, today) {
  const done = list.filter(m => m.done).map(m => m.key);
  if (!prev) return { next: Object.fromEntries(done.map(k => [k, today])), newly: [] };
  const newly = done.filter(k => !prev[k]);
  return { next: newly.length ? { ...prev, ...Object.fromEntries(newly.map(k => [k, today])) } : prev, newly };
}

/*
  Selos: earned from what the family did. facts: { starterComplete, hasCard, closedCount, finished: [{ month, res, tx }]
  (finished months with statement, oldest first), goal, taught (rules the family taught), members, sundays (Sundays with
  the open bill informed this year) }
*/
export function badges(f = {}) {
  const fin = f.finished || [], streak = fin.reduce((a, m) => (m.res > 0 ? a + 1 : 0), 0), best = Math.max(0, ...fin.map((_, i) => { let n = 0; for (let j = i; j < fin.length && fin[j].res > 0; j++) n++; return n; }));
  return [
    { id: 'primeira_fatura', title: 'Primeira fatura', how: 'Mandar a primeira fatura do cartão.', earned: !!f.hasCard },
    { id: 'familia_organizada', title: 'Família organizada', how: 'Cumprir as 6 missões de começo.', earned: !!f.starterComplete },
    { id: 'mes_fechado', title: 'Mês fechado', how: 'Fechar um mês com a retrospectiva.', earned: (+f.closedCount || 0) > 0 },
    { id: 'meta_batida', title: 'Meta batida', how: 'Guardar a meta de vocês num mês.', earned: !!f.goal && fin.some(m => m.tx >= f.goal) },
    { id: 'tres_no_azul', title: '3 meses no azul', how: 'Três meses seguidos com sobra.', earned: best >= 3, progress: best >= 3 ? null : `${streak} de 3` },
    { id: 'app_ensinado', title: 'App bem ensinado', how: 'Ensinar 10 categorias ao app (no Extrato ou na revisão).', earned: (+f.taught || 0) >= 10, progress: (+f.taught || 0) >= 10 ? null : `${Math.min(10, +f.taught || 0)} de 10` },
    { id: 'em_familia', title: 'Em família', how: 'Ter mais alguém da família no app.', earned: (+f.members || 0) > 1 },
    { id: 'previsao_em_dia', title: 'Previsão em dia', how: 'Informar a fatura aberta em 4 domingos.', earned: (+f.sundays || 0) >= 4, progress: (+f.sundays || 0) >= 4 ? null : `${+f.sundays || 0} de 4` },
  ];
}
