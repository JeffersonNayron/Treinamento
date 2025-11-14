// server.js - Node + SQLite (SEM helmet)
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const session = require('express-session');

const app = express();
const DB_PATH = path.join(__dirname, 'treinamento.db');
const db = new Database(DB_PATH);

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'troque-esse-secret-para-producao',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8h
}));

// servir estáticos (pasta public)
app.use(express.static(path.join(__dirname, 'public')));

// criar tabela se não existir
db.prepare(`
  CREATE TABLE IF NOT EXISTS pessoas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    teorico TEXT,
    acomp1 TEXT,
    acomp2 TEXT,
    acomp3 TEXT,
    acomp4 TEXT,
    liberado TEXT DEFAULT 'red'
  )
`).run();

// seed exemplo
const c = db.prepare('SELECT COUNT(1) AS c FROM pessoas').get();
if (c.c === 0) {
  const ins = db.prepare('INSERT INTO pessoas (nome, liberado) VALUES (?, ?)');
  ['Ana Silva','Bruno Costa','Carlos Lima','Diana Rocha'].forEach(n => ins.run(n, 'red'));
}

// endpoints

// login
app.post('/api/login', (req, res) => {
  const { role, password, nomeTreinamento } = req.body;
  if (!role) return res.status(400).json({ error: 'role required' });

  // salvar nome do treinamento
  req.session.nomeTreinamento = nomeTreinamento || 'Treinamento';

  if (role === 'EQUIPE') {
    req.session.role = 'EQUIPE';
    return res.json({ ok: true });
  }
  if (role === 'ADM') {
    if (password === '0000') {
      req.session.role = 'ADM';
      return res.json({ ok: true });
    } else {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
  }
  return res.status(400).json({ error: 'role inválido' });
});

// logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// session info
app.get('/api/session', (req, res) => {
  res.json({
    user: req.session.role ? { role: req.session.role, nomeTreinamento: req.session.nomeTreinamento } : null
  });
});

// middleware para proteger rotas de escrita
function requireAdmin(req, res, next) {
  if (req.session.role === 'ADM') return next();
  return res.status(403).json({ error: 'Apenas ADM' });
}

// listar pessoas (leitura para ambos)
app.get('/api/pessoas', (req, res) => {
  const rows = db.prepare('SELECT * FROM pessoas ORDER BY id').all();
  res.json(rows);
});

// adicionar pessoa (ADM)
app.post('/api/pessoas', requireAdmin, (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  const info = db.prepare('INSERT INTO pessoas (nome, liberado) VALUES (?, ?)').run(nome.trim(), 'red');
  const nova = db.prepare('SELECT * FROM pessoas WHERE id = ?').get(info.lastInsertRowid);
  res.json(nova);
});

// editar campo genérico (ADM)
app.put('/api/pessoas/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { field, value } = req.body;
  const allowed = ['nome','teorico','acomp1','acomp2','acomp3','acomp4','liberado'];
  if (!allowed.includes(field)) return res.status(400).json({ error: 'campo inválido' });

  // atualizar
  db.prepare(`UPDATE pessoas SET ${field} = ? WHERE id = ?`).run(value || null, id);
  const updated = db.prepare('SELECT * FROM pessoas WHERE id = ?').get(id);
  res.json(updated);
});

// excluir pessoa (ADM)
app.delete('/api/pessoas/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);

  const del = db.prepare('DELETE FROM pessoas WHERE id = ?').run(id);

  if (del.changes === 0) {
    return res.status(404).json({ error: 'Pessoa não encontrada' });
  }

  res.json({ ok: true });
});


// ciclo liberado (ADM) - alterna red -> yellow -> green
app.put('/api/pessoas/:id/cicloLiberado', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const cur = db.prepare('SELECT liberado FROM pessoas WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'não encontrado' });
  const order = ['red','yellow','green'];
  const idx = Math.max(0, order.indexOf(cur.liberado || 'red'));
  const next = order[(idx + 1) % order.length];
  db.prepare('UPDATE pessoas SET liberado = ? WHERE id = ?').run(next, id);
  const updated = db.prepare('SELECT * FROM pessoas WHERE id = ?').get(id);
  res.json(updated);
});





// fallback: servir index.html para rotas desconhecidas (SPA)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando: http://localhost:${PORT}`));
