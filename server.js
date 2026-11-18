const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET não definida no arquivo .env');
}
if (isProduction) app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));

const pool = new Pool({
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'pacs_db',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
});

app.use(session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  name: 'pacs.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

// Disponibiliza somente os arquivos públicos do frontend.
app.use(express.static(path.join(__dirname, 'public')));

function publicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    matricula: user.matricula,
    email: user.email,
    cargo: user.cargo,
    ramal: user.ramal,
    unidade: user.unidade,
    setor: user.setor,
    role: user.role,
  };
}

function autenticar(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  req.user = req.session.user;
  next();
}

function permitirPerfil(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Você não tem permissão para esta operação.' });
    }
    next();
  };
}

// Autenticação específica para páginas HTML.
function autenticarPagina(req, res, next) {
  if (!req.session || !req.session.user) {
      return res.redirect('/login.html');
  }

  req.user = req.session.user;

  // Evita armazenar páginas protegidas no cache do navegador.
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');

  next();
}

// Autorização específica para páginas HTML.
function permitirPagina(...roles) {
  return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
          if (req.user?.role === 'manutencao') {
              return res.redirect('/manutencao.html');
          }

          if (req.user?.role === 'requisitante') {
              return res.redirect('/requisitante.html');
          }

          return res.redirect('/login.html');
      }

      next();
  };
}

// Página inicial
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Login: acesso público
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'views', 'login.html'));
});

// Painel da manutenção
app.get(
  '/manutencao.html',
  autenticarPagina,
  permitirPagina('manutencao'),
  (req, res) => {
      res.sendFile(path.join(__dirname, 'src', 'views', 'manutencao.html'));
  }
);

// Painel do requisitante
app.get(
  '/requisitante.html',
  autenticarPagina,
  permitirPagina('requisitante'),
  (req, res) => {
      res.sendFile(path.join(__dirname, 'src', 'views', 'requisitante.html'));
  }
);

// Detalhes da demanda
app.get(
  '/detalhes-demanda.html',
  autenticarPagina,
  permitirPagina('manutencao'),
  (req, res) => {
      res.sendFile(path.join(__dirname, 'src', 'views', 'detalhes-demanda.html'));
  }
);

// Detalhes da ordem de serviço
app.get(
  '/detalhes-os.html',
  autenticarPagina,
  permitirPagina('manutencao'),
  (req, res) => {
      res.sendFile(path.join(__dirname, 'src', 'views', 'detalhes-os.html'));
  }
);

function validarOrigem(req, res, next) {
  const origin = req.get('Origin');
  if (origin) {
    const expected = `${req.protocol}://${req.get('host')}`;
    if (origin !== expected) {
      return res.status(403).json({ error: 'Origem da requisição não permitida.' });
    }
  }
  next();
}

app.post('/api/register', validarOrigem, async (req, res) => {
  const { nome, matricula, email, senha, cargo, unidade, setor, ramal } = req.body || {};
  if (!nome || !matricula || !email || !senha || !unidade) {
    return res.status(400).json({ error: 'Preencha nome, matrícula, e-mail, senha e unidade.' });
  }
  if (String(senha).length < 8) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      `INSERT INTO users (nome, matricula, email, senha, cargo, unidade, setor, ramal, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'requisitante')
       RETURNING id, nome, email, unidade`,
      [nome, matricula, email, hashedPassword, cargo || null, unidade, setor || null, ramal || null]
    );
    res.status(201).json({ message: 'Cadastro realizado com sucesso!', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Matrícula ou e-mail já cadastrado.' });
    console.error('Erro no cadastro:', err.message);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

app.post('/api/login', validarOrigem, async (req, res) => {
  const { identifier, senha } = req.body || {};
  if (!identifier || !senha) return res.status(400).json({ error: 'Informe matrícula/e-mail e senha.' });
  try {
    const result = await pool.query(
      'SELECT id, nome, matricula, email, cargo, ramal, unidade, setor, role, senha FROM users WHERE matricula = $1 OR email = $1',
      [identifier]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    const user = result.rows[0];
    const match = await bcrypt.compare(senha, user.senha);
    if (!match) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    if (!['requisitante', 'manutencao'].includes(user.role)) {
      return res.status(403).json({ error: 'Perfil de usuário não autorizado.' });
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error('Erro ao criar sessão:', err.message);
        return res.status(500).json({ error: 'Não foi possível iniciar a sessão.' });
      }
      req.session.user = publicUser(user);
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Erro ao salvar sessão:', saveErr.message);
          return res.status(500).json({ error: 'Não foi possível salvar a sessão.' });
        }
        res.json({ message: 'Login realizado com sucesso!', user: publicUser(user) });
      });
    });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ error: 'Erro no servidor durante o login.' });
  }
});

app.post('/api/logout', validarOrigem, (req, res) => {
  if (!req.session) return res.json({ message: 'Sessão encerrada.' });
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Não foi possível encerrar a sessão.' });
    res.clearCookie('pacs.sid', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
    res.json({ message: 'Logout realizado com sucesso.' });
  });
});

// Todas as demais rotas /api exigem sessão válida.
app.use('/api', autenticar);
app.use('/api', validarOrigem);

app.get('/api/me', (req, res) => res.json({ user: req.user }));

// Demandas
app.get('/api/demands', permitirPerfil('manutencao'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.location, d.description, d.status, d.created_at,
             u.nome AS solicitante, u.unidade, u.setor
      FROM demands d JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar demandas:', err.message);
    res.status(500).json({ error: 'Erro ao buscar demandas.' });
  }
});

app.get('/api/demands/user/:userId', async (req, res) => {
  const requestedId = Number(req.params.userId);
  if (req.user.role !== 'manutencao' && requestedId !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Você só pode consultar suas próprias solicitações.' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM demands WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.role === 'manutencao' ? requestedId : req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar demandas do usuário:', err.message);
    res.status(500).json({ error: 'Erro ao buscar demandas.' });
  }
});

app.get('/api/demands/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.location, d.description, d.status, d.created_at,
             u.id AS user_id, u.nome, u.matricula, u.cargo, u.unidade, u.setor, u.ramal
      FROM demands d JOIN users u ON d.user_id = u.id
      WHERE d.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Demanda não encontrada.' });
    if (req.user.role !== 'manutencao' && Number(result.rows[0].user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Você não tem acesso a esta solicitação.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar demanda:', err.message);
    res.status(500).json({ error: 'Erro ao buscar detalhes da demanda.' });
  }
});

app.post('/api/demands', validarOrigem, permitirPerfil('requisitante'), async (req, res) => {
  const { location, description } = req.body || {};
  if (!location || !description) return res.status(400).json({ error: 'Informe local e descrição.' });
  try {
    const result = await pool.query(
      `INSERT INTO demands (user_id, location, description, status)
       VALUES ($1,$2,$3,'Pendente')
       RETURNING id, location, description, status, created_at`,
      [req.user.id, location, description]
    );
    res.status(201).json({ message: 'Demanda aberta com sucesso!', demand: result.rows[0] });
  } catch (err) {
    console.error('Erro ao registrar demanda:', err.message);
    res.status(500).json({ error: 'Erro ao registrar demanda.' });
  }
});

app.patch('/api/demands/:id/status', permitirPerfil('manutencao'), async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Informe o status.' });
  try {
    const result = await pool.query(
      'UPDATE demands SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Demanda não encontrada.' });
    res.json({ message: 'Status atualizado!', demand: result.rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar demanda:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

// Ordens de serviço: acesso exclusivo à manutenção.
app.post('/api/demands/:demandId/os', permitirPerfil('manutencao'), async (req, res) => {
  const { specialty, instructions, contrato_id } = req.body || {};
  if (!specialty) return res.status(400).json({ error: 'Informe a especialidade.' });
  try {
    const result = await pool.query(
      `INSERT INTO ordens_servico (demand_id, specialty, instructions, contrato_id, status)
       VALUES ($1,$2,$3,$4,'Aberta') RETURNING *`,
      [req.params.demandId, specialty, instructions || null, contrato_id || null]
    );
    res.status(201).json({ message: 'Ordem de Serviço gerada com sucesso!', os: result.rows[0] });
  } catch (err) {
    console.error('Erro ao criar OS:', err.message);
    res.status(500).json({ error: 'Erro ao criar Ordem de Serviço.' });
  }
});

app.get('/api/demands/:demandId/os', permitirPerfil('manutencao'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ordens_servico WHERE demand_id = $1 ORDER BY created_at DESC',
      [req.params.demandId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar OS:', err.message);
    res.status(500).json({ error: 'Erro ao listar ordens de serviço.' });
  }
});

app.get('/api/os/:id/historico', permitirPerfil('manutencao'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM os_historicos WHERE ordem_servico_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err.message);
    res.status(500).json({ error: 'Erro ao carregar o histórico.' });
  }
});

app.get('/api/os/:id', permitirPerfil('manutencao'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT os.*, d.location, d.description AS demand_description,
             d.created_at AS demand_date, u.nome AS solicitante, u.unidade, u.setor,
             c.numero_contrato, c.objeto AS contrato_objeto,
             e.nome AS empresa_nome, e.cnpj AS empresa_cnpj
      FROM ordens_servico os
      JOIN demands d ON os.demand_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN contratos c ON os.contrato_id = c.id
      LEFT JOIN empresas e ON c.empresa_id = e.id
      WHERE os.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Ordem de Serviço não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar OS:', err.message);
    res.status(500).json({ error: 'Erro ao buscar OS.' });
  }
});

app.patch('/api/os/:id', permitirPerfil('manutencao'), async (req, res) => {
  const {
    status, priority, execution_notes, materials_used,
    attachment_url, pending_reason, contrato_id, completed_at
  } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      'SELECT status FROM ordens_servico WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ordem de Serviço não encontrada.' });
    }
    const previousStatus = current.rows[0].status;
    const newStatus = status || previousStatus;

    if (newStatus === 'Concluída' && !attachment_url) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'O anexo da OS física assinada é obrigatório para concluir o serviço.' });
    }
    if (newStatus === 'Pendente' && !pending_reason) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'O motivo da pendência deve ser selecionado.' });
    }


    const updated = await client.query(`
UPDATE ordens_servico SET
  status = $1::varchar,
  priority = COALESCE(NULLIF($2::text, '')::os_prioridade, priority),
  execution_notes = COALESCE($3::text, execution_notes),
  materials_used = COALESCE($4::text, materials_used),
  attachment_url = COALESCE($5::text, attachment_url),
  pending_reason = COALESCE($6::text, pending_reason),
  contrato_id = CASE
    WHEN $7::text IS NULL OR $7::text = '' THEN contrato_id
    ELSE $7::integer
  END,
  completed_at = CASE
    WHEN $1::varchar = 'Concluída'
      THEN COALESCE(NULLIF($8::text, '')::timestamp, CURRENT_TIMESTAMP)
    ELSE completed_at
  END
WHERE id = $9
RETURNING *
`,
      [
        newStatus,
        priority ?? null,
        execution_notes ?? null,
        materials_used ?? null,
        attachment_url ?? null,
        pending_reason ?? null,
        contrato_id === undefined ? null : String(contrato_id),
        completed_at || null,
        req.params.id
      ]);


    const observation = execution_notes || `Status alterado de "${previousStatus || 'Início'}" para "${newStatus}"`;
    await client.query(
      `INSERT INTO os_historicos
       (ordem_servico_id, previous_status, new_status, changed_by, observations)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, previousStatus, newStatus, req.user.nome, observation]
    );
    await client.query('COMMIT');
    res.json({ message: 'Ordem de Serviço atualizada com sucesso!', os: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Erro ao atualizar OS:', err.message);
    res.status(500).json({ error: 'Erro interno ao atualizar Ordem de Serviço.' });
  } finally {
    client.release();
  }
});

app.get('/api/contratos', permitirPerfil('manutencao'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.numero_contrato, c.objeto, e.nome AS empresa_nome
      FROM contratos c JOIN empresas e ON c.empresa_id = e.id
      ORDER BY e.nome ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar contratos:', err.message);
    res.status(500).json({ error: 'Erro ao listar contratos.' });
  }
});

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
