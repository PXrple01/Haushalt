// Datenspeicher. Die App spricht nur mit `store`. Der eigentliche Speicherort ist ein
// "Adapter" – heute localStorage, später z. B. ein Server für den Sync zwischen zwei Handys.
// Ein neuer Adapter muss nur load() und save(data) anbieten.

const KEY = 'haushaltsbuch.v1';

export class LocalAdapter {
  load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }
  save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
  }
}

// Beispiel für später:
// export class RemoteAdapter { constructor(url, token) {…} async load() {…} async save(data) {…} }

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const COLORS = ['#6366F1', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#94A3B8',
  '#22C55E', '#10B981', '#84CC16', '#0EA5E9', '#A855F7', '#EAB308', '#64748B', '#D946EF'];

export function defaultCategories() {
  const e = (id, emoji, name, color, hint, fixed = false) => ({ id, type: 'expense', emoji, name, color, hint, fixed, budget: 0 });
  const i = (id, emoji, name, color) => ({ id, type: 'income', emoji, name, color, budget: 0 });
  return [
    e('wohnen', '🏠', 'Miete & Wohnen', '#6366F1', 'Miete, Strom, Internet', true),
    e('abos', '🔁', 'Abos', '#8B5CF6', 'Netflix, Spotify, Handy, Spiele-Abos', true),
    e('essen', '🛒', 'Essen & Einkauf', '#F59E0B', 'Supermarkt, Snacks, Essen gehen'),
    e('bus', '🚌', 'Bus & Fahrkarte', '#06B6D4', 'Monatskarte, Tickets'),
    e('freizeit', '🎮', 'Freizeit & Zocken', '#EC4899', 'Kino, Spiele, Ausgehen'),
    e('kleidung', '👕', 'Kleidung', '#14B8A6', 'Klamotten, Schuhe'),
    e('geschenke', '🎁', 'Geschenke', '#F97316', 'Geburtstage, Überraschungen'),
    e('sonst-a', '📦', 'Sonstiges', '#94A3B8', 'Alles andere'),
    i('taschengeld', '💶', 'Taschengeld', '#22C55E'),
    i('unterhalt', '🤝', 'Unterhalt', '#10B981'),
    i('kindergeld', '👶', 'Kindergeld', '#84CC16'),
    i('sonst-e', '✨', 'Sonstiges', '#4ADE80'),
  ];
}

export function emptyData() {
  return {
    version: 1,
    settings: {
      currency: 'EUR',
      monthStartDay: 1,
      monthlyBudget: 0,
      pin: null,
      devicePerson: 'me',
      profiles: { me: { name: 'Ich', emoji: '🙋' }, partner: { name: 'Freundin', emoji: '💁‍♀️' } },
    },
    categories: defaultCategories(),
    transactions: [], // {id,type,amount,categoryId,date,note,person,shared,recurringId?,demo?,updatedAt}
    recurring: [],    // {id,type,amount,categoryId,day,person,shared,note,active,start:'YYYY-MM',booked:[]}
    goals: [],        // {id,name,emoji,target,deadline?,plan,moves:[{id,amount,date}]}
  };
}

export const store = {
  adapter: new LocalAdapter(),
  data: null,
  init(adapter) {
    if (adapter) this.adapter = adapter;
    const loaded = this.adapter.load();
    this.data = migrate(loaded || emptyData());
    return this.data;
  },
  save() { return this.adapter.save(this.data); },
  replace(data) { this.data = migrate(data); this.save(); },
  reset() { this.data = emptyData(); this.save(); },
};

function migrate(d) {
  const base = emptyData();
  d.settings = { ...base.settings, ...(d.settings || {}) };
  d.settings.profiles = { ...base.settings.profiles, ...(d.settings.profiles || {}) };
  d.categories ||= base.categories;
  d.transactions ||= [];
  d.recurring ||= [];
  d.goals ||= [];
  for (const g of d.goals) g.moves ||= [];
  d.version = 1;
  return d;
}

/** Führt zwei Datenstände zusammen (z. B. Export vom anderen Handy). Neuere Einträge gewinnen. */
export function mergeData(cur, inc) {
  const byId = (a, b) => {
    const m = new Map(a.map(x => [x.id, x]));
    for (const x of b || []) {
      const old = m.get(x.id);
      if (!old || (x.updatedAt || 0) > (old.updatedAt || 0)) m.set(x.id, x);
    }
    return [...m.values()];
  };
  cur.categories = byId(cur.categories, inc.categories);
  cur.transactions = byId(cur.transactions, inc.transactions);
  cur.recurring = byId(cur.recurring, inc.recurring);
  // Ziele: Bewegungen vereinigen
  const goals = new Map(cur.goals.map(g => [g.id, g]));
  for (const g of inc.goals || []) {
    const old = goals.get(g.id);
    if (!old) { goals.set(g.id, g); continue; }
    const moves = byId(old.moves, g.moves);
    const newer = (g.updatedAt || 0) > (old.updatedAt || 0) ? g : old;
    goals.set(g.id, { ...newer, moves });
  }
  cur.goals = [...goals.values()];
  return cur;
}
