const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configuração da conexão com o PostgreSQL (pacs_db)
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'pacs_db',
    password: 'Dorothy@456', // Lembre-se de colocar sua senha real aqui
    port: 5432,
});

// Rota de Cadastro de Usuário
// 1. Cadastro forçando o perfil de requisitante
app.post('/api/register', async (req, res) => {
    const { nome, matricula, email, senha, cargo, unidade, setor, ramal } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(senha, 10);

        const query = `
        INSERT INTO users (nome, matricula, email, senha, cargo, unidade, setor, ramal, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'requisitante')
        RETURNING id, nome, email, unidade;
      `;
        const values = [nome, matricula, email, hashedPassword, cargo, unidade, setor, ramal];
        const result = await pool.query(query, values);

        res.status(201).json({ message: 'Cadastro solicitado com sucesso!', user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
    }
});

// 2. Login retornando o 'role'
app.post('/api/login', async (req, res) => {
    const { identifier, senha } = req.body;
    try {
        const query = 'SELECT * FROM users WHERE matricula = $1 OR email = $1';
        const result = await pool.query(query, [identifier]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(senha, user.senha);

        if (!match) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        res.json({
            message: 'Login realizado com sucesso!',
            user: {
                id: user.id,
                nome: user.nome,
                matricula: user.matricula,
                ramal: user.ramal,
                unidade: user.unidade,
                setor: user.setor,
                role: user.role // <-- Essencial para o redirecionamento
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no servidor durante o login.' });
    }
});

// 3. Listar TODAS as demandas para a Manutenção
app.get('/api/demands', async (req, res) => {
    try {
        const query = `
        SELECT d.id, d.location, d.description, d.status, d.created_at, u.nome AS solicitante, u.unidade, u.setor 
        FROM demands d
        JOIN users u ON d.user_id = u.id
        ORDER BY d.created_at DESC;
      `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar demandas.' });
    }
});

// 4. Atualizar Status (Manutenção)
app.patch('/api/demands/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const query = 'UPDATE demands SET status = $1 WHERE id = $2 RETURNING *;';
        const result = await pool.query(query, [status, id]);
        res.json({ message: 'Status atualizado!', demand: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar status.' });
    }
});

// Rota para Criar Demanda (Ordens de Serviço)
app.post('/api/demands', async (req, res) => {
    const { userId, location, description } = req.body;
    try {
        const query = `
      INSERT INTO demands (user_id, location, description, status)
      VALUES ($1, $2, $3, 'Pendente')
      RETURNING id, location, description, status, created_at;
    `;
        const result = await pool.query(query, [userId, location, description]);
        res.status(201).json({ message: 'Demanda aberta com sucesso!', demand: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao registrar demanda.' });
    }
});

// Rota para Listar as Demandas de um usuário
app.get('/api/demands/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const query = 'SELECT * FROM demands WHERE user_id = $1 ORDER BY created_at DESC';
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar demandas.' });
    }
});

// Inicialização do Servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});