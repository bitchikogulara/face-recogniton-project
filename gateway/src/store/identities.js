const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../../data/identities.json');

function load() {
  if (!fs.existsSync(STORE_PATH)) return { users: {} };
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function save(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function getUser(userId) {
  return load().users[userId] ?? null;
}

function upsertUser(userId, data) {
  const store = load();
  store.users[userId] = { ...store.users[userId], ...data };
  save(store);
  return store.users[userId];
}

function listUsers() {
  const store = load();
  return Object.entries(store.users).map(([id, u]) => ({ userId: id, ...u }));
}

module.exports = { getUser, upsertUser, listUsers };
