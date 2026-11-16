const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname)));

// ÚNICA declaração correta da conexão com o PostgreSQL apontando para o container 'db'
const pool = new Pool({
    user: 'postgres',
    host: 'db',
    database: 'pacs_db',
    password: 'pacsadmin',
    port: 5432,
});

// Configuração para servir os arquivos HTML, CSS e JS da raiz do projeto
app.use(express.static(path.join(__dirname)));

// 1. Cadastro de Usuário (requisitante)
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

// 2. Login
app.post('/api/login', async (req, res) => {
    console.log("Dados recebidos no login:", req.body); // <-- Adicione esta linha
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
                role: user.role
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

// 4. Listar as Demandas de um usuário específico (DEVE vir ANTES de /:id)
app.get('/api/demands/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const query = 'SELECT * FROM demands WHERE user_id = $1 ORDER BY created_at DESC';
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar demandas do usuário.' });
    }
});

// 5. Buscar detalhes de UMA demanda específica por ID (com dados do solicitante)
app.get('/api/demands/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
              d.id, d.location, d.description, d.status, d.created_at, 
              u.id AS user_id, u.nome, u.matricula, u.cargo, u.unidade, u.setor, u.ramal
            FROM demands d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = $1;
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Demanda não encontrada.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar detalhes da demanda.' });
    }
});

// 6. Criar nova Demanda
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

// 7. Atualizar Status da Demanda (Manutenção)
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

// 8. Ajustar a criação de OS para receber o contrato_id
app.post('/api/demands/:demandId/os', async (req, res) => {
    const { demandId } = req.params;
    const { specialty, instructions, contrato_id } = req.body;

    try {
        const query = `
            INSERT INTO ordens_servico (demand_id, specialty, instructions, contrato_id, status)
            VALUES ($1, $2, $3, $4, 'Aberta')
            RETURNING *;
        `;
        const result = await pool.query(query, [demandId, specialty, instructions, contrato_id || null]);
        res.status(201).json({ message: 'Ordem de Serviço gerada com sucesso!', os: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar Ordem de Serviço.' });
    }
});

// 9. Listar todas as OSs de uma demanda específica
app.get('/api/demands/:demandId/os', async (req, res) => {
    const { demandId } = req.params;
    try {
        const query = `SELECT * FROM ordens_servico WHERE demand_id = $1 ORDER BY created_at DESC;`;
        const result = await pool.query(query, [demandId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar ordens de serviço.' });
    }
});

// Inicialização do Servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// 10. Ajustar a rota de detalhes da OS (/api/os/:id) para trazer os dados da empresa e contrato
app.get('/api/os/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                os.*, 
                d.location, d.description as demand_description, d.created_at as demand_date,
                u.nome as solicitante, u.unidade, u.setor,
                c.numero_contrato, c.objeto as contrato_objeto,
                e.nome as empresa_nome, e.cnpj as empresa_cnpj
            FROM ordens_servico os
            JOIN demands d ON os.demand_id = d.id
            JOIN users u ON d.user_id = u.id
            LEFT JOIN contratos c ON os.contrato_id = c.id
            LEFT JOIN empresas e ON c.empresa_id = e.id
            WHERE os.id = $1;
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ordem de Serviço não encontrada.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar OS.' });
    }
});

// 11 Ajustar o PATCH da OS para atualizar também o contrato_id
app.patch('/api/os/:id', async (req, res) => {
    const { id } = req.params;
    const { status, execution_notes, materials_used, completed_at, contrato_id } = req.body;

    try {
        const query = `
            UPDATE ordens_servico 
            SET status = COALESCE($1, status), 
                execution_notes = COALESCE($2, execution_notes), 
                materials_used = COALESCE($3, materials_used),
                completed_at = COALESCE(NULLIF($4, '')::timestamp, completed_at),
                contrato_id = COALESCE($5, contrato_id)
            WHERE id = $6 
            RETURNING *;
        `;
        const result = await pool.query(query, [status, execution_notes, materials_used, completed_at, contrato_id || null, id]);

        res.json({ message: 'Ordem de Serviço atualizada com sucesso!', os: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar Ordem de Serviço.' });
    }
});

// 12. Listar Empresas e Contratos (para preencher selects no front-end)
app.get('/api/contratos', async (req, res) => {
    try {
        const query = `
            SELECT c.id, c.numero_contrato, c.objeto, e.nome AS empresa_nome 
            FROM contratos c
            JOIN empresas e ON c.empresa_id = e.id
            ORDER BY e.nome ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar contratos.' });
    }
});

// ==========================================
// ROTA: Buscar o histórico de auditoria (Timeline) da OS
// ==========================================
app.get('/api/os/:id/historico', async (req, res) => {
    const { id } = req.params;
    try {
        const historico = await pool.query(
            'SELECT * FROM os_historicos WHERE ordem_servico_id = $1 ORDER BY created_at DESC',
            [id]
        );
        res.json(historico.rows);
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ error: 'Erro ao carregar o histórico de auditoria.' });
    }
});

// ==========================================
// ROTA: Atualizar OS e Registrar Auditoria Automaticamente
// ==========================================
app.patch('/api/os/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        status, 
        priority, 
        execution_notes, 
        materials_used, 
        attachment_url, 
        pending_reason, 
        contrato_id,
        changed_by 
    } = req.body;

    try {
        // Busca o status anterior da OS para registrar corretamente no histórico
        const osAtual = await pool.query('SELECT status FROM ordens_servico WHERE id = $1', [id]);
        if (osAtual.rows.length === 0) {
            return res.status(404).json({ error: 'Ordem de Serviço não encontrada.' });
        }
        const previousStatus = osAtual.rows[0].status;

        // Validações de Negócio
        if (status === 'Concluída' && !attachment_url) {
            return res.status(400).json({ error: 'O anexo da OS física assinada é obrigatório para concluir o serviço.' });
        }
        if (status === 'Pendente' && !pending_reason) {
            return res.status(400).json({ error: 'O motivo da pendência deve ser selecionado.' });
        }

        // Executa o Update na tabela ordens_servico
        const updateQuery = `
            UPDATE ordens_servico 
            SET status = $1, 
                priority = COALESCE(NULLIF($2, ''), priority)::os_prioridade, 
                execution_notes = $3, 
                materials_used = $4, 
                attachment_url = $5, 
                pending_reason = $6, 
                contrato_id = $7,
                completed_at = CASE WHEN $1 = 'Concluída' THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE id = $8 
            RETURNING *;
        `;
        const values = [status, priority, execution_notes, materials_used, attachment_url, pending_reason, contrato_id || null, id];
        const updatedOs = await pool.query(updateQuery, values);

        // Insere o registro de auditoria na tabela os_historicos
        const observacaoLog = execution_notes || `Status alterado de "${previousStatus || 'Início'}" para "${status}"`;
        await pool.query(
            `INSERT INTO os_historicos (ordem_servico_id, previous_status, new_status, changed_by, observations) 
             VALUES ($1, $2, $3, $4, $5)`,
            [id, previousStatus, status, changed_by || 'Equipe Técnica', observacaoLog]
        );

        res.json({ message: 'Ordem de Serviço atualizada com sucesso!', os: updatedOs.rows[0] });
    } catch (error) {
        console.error('Erro ao atualizar OS:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar Ordem de Serviço.' });
    }
});