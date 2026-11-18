document.addEventListener('DOMContentLoaded', async () => {
    const toastContainer = document.getElementById('toastContainer');
    const osUpdateForm = document.getElementById('osUpdateForm');
    const btnVoltar = document.getElementById('btnVoltar');

    const urlParams = new URLSearchParams(window.location.search);
    const osId = urlParams.get('id');

    if (!osId) {
        alert('Nenhuma Ordem de Serviço selecionada.');
        window.location.href = '/manutencao.html';
        return;
    }

    let demandIdGlobal = null;

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Formata data do banco para o formato esperado pelo input datetime-local (YYYY-MM-DDTHH:mm)
    function formatarParaDatetimeLocal(dataIso) {
        if (!dataIso) return '';
        const d = new Date(dataIso);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // --- CONTROLE DE CAMPOS CONDICIONAIS NA TELA ---
    window.verificarCamposDinamicos = function() {
        const status = document.getElementById('osStatus').value;
        const pendenciaContainer = document.getElementById('pendenciaContainer');
        const anexoContainer = document.getElementById('anexoContainer');

        if (pendenciaContainer) {
            pendenciaContainer.style.display = (status === 'Pendente') ? 'block' : 'none';
        }
        if (anexoContainer) {
            anexoContainer.style.display = (status === 'Concluída' || status === 'Finalizada') ? 'block' : 'none';
        }
    };

    // --- CARREGAR CONTRATOS NO SELECT ---
    async function carregarContratosNoSelect(contratoAtualId) {
        try {
            const response = await fetch('/api/contratos');
            const contratos = await response.json();
            const select = document.getElementById('osContratoSelect');

            if (!select) return;

            contratos.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = `${c.empresa_nome} - Contrato: ${c.numero_contrato}`;
                if (c.id === contratoAtualId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao carregar contratos:', error);
        }
    }

    // --- CARREGAR HISTÓRICO DE AUDITORIA (TIMELINE) ---
    async function carregarHistoricoOS() {
        const timelineContainer = document.getElementById('timelineContainer');
        if (!timelineContainer) return;

        try {
            const response = await fetch(`/api/os/${osId}/historico`);
            const historicos = await response.json();

            if (historicos.length === 0) {
                timelineContainer.innerHTML = `<p class="text-muted">Nenhum registro de auditoria encontrado.</p>`;
                return;
            }

            timelineContainer.innerHTML = historicos.map(h => `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
                            <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${h.new_status}</span>
                            <span style="color: var(--text-muted); font-size: 13px;">(Anterior: ${h.previous_status || 'Início'})</span>
                        </div>
                        <p style="font-size: 14px; margin-top: 4px;">${h.observations || 'Sem observações adicionais.'}</p>
                        <small style="color: var(--text-muted); display: block; margin-top: 6px;">Responsável: <strong>${h.changed_by}</strong></small>
                    </div>
                    <div style="text-align: right; font-size: 12px; color: var(--text-muted);">
                        ${new Date(h.created_at).toLocaleString('pt-BR')}
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            timelineContainer.innerHTML = `<p class="text-muted" style="color: #ef4444;">Erro ao carregar a linha do tempo de auditoria.</p>`;
        }
    }

    // --- CARREGAR DADOS DA OS ---
    async function carregarDetalhesOS() {
        try {
            const response = await fetch(`/api/os/${osId}`);
            if (!response.ok) throw new Error('OS não encontrada.');

            const os = await response.json();
            demandIdGlobal = os.demand_id;

            btnVoltar.onclick = () => {
                window.location.href = `/detalhes-demanda.html?id=${os.demand_id}`;
            };

            document.getElementById('osTitle').textContent = `Ordem de Serviço #OS-${os.id} (Demanda #${os.demand_id})`;
            document.getElementById('infoSpecialty').textContent = os.specialty;
            document.getElementById('infoCreatedAt').textContent = new Date(os.created_at).toLocaleString('pt-BR');
            document.getElementById('infoLocation').textContent = os.location;
            document.getElementById('infoSolicitante').textContent = `${os.solicitante} (${os.unidade} / ${os.setor || 'N/A'})`;
            document.getElementById('infoInstructions').textContent = os.instructions || 'Nenhuma instrução específica.';

            // Preenche os campos de formulário com os dados salvos
            document.getElementById('osStatus').value = os.status || 'Aberta';
            
            if (document.getElementById('osPriority')) {
                document.getElementById('osPriority').value = os.priority || 'MEDIA';
            }
            if (document.getElementById('osPendingReason')) {
                document.getElementById('osPendingReason').value = os.pending_reason || '';
            }
            if (document.getElementById('osAttachmentUrl')) {
                document.getElementById('osAttachmentUrl').value = os.attachment_url || '';
            }

            document.getElementById('osCompletedAt').value = formatarParaDatetimeLocal(os.completed_at);
            document.getElementById('osExecutionNotes').value = os.execution_notes || '';
            document.getElementById('osMaterials').value = os.materials_used || '';

            // Dispara a verificação para exibir os campos condicionais caso necessário ao abrir a página
            verificarCamposDinamicos();

            // Carrega os contratos e seleciona o da OS atual
            await carregarContratosNoSelect(os.contrato_id);

            // Carrega a timeline de auditoria
            await carregarHistoricoOS();

        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar detalhes da OS.', 'error');
        }
    }

    // --- SALVAR ATUALIZAÇÕES DA OS (COM SUPORTE A AUDITORIA E REGRAS) ---
    osUpdateForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const status = document.getElementById('osStatus').value;
        const priority = document.getElementById('osPriority') ? document.getElementById('osPriority').value : 'MEDIA';
        const pending_reason = document.getElementById('osPendingReason') ? document.getElementById('osPendingReason').value : null;
        const attachment_url = document.getElementById('osAttachmentUrl') ? document.getElementById('osAttachmentUrl').value.trim() : null;
        
        const completed_at = document.getElementById('osCompletedAt').value;
        const execution_notes = document.getElementById('osExecutionNotes').value.trim();
        const materials_used = document.getElementById('osMaterials').value.trim();
        const contrato_id = document.getElementById('osContratoSelect') ? document.getElementById('osContratoSelect').value : null;
try {
            const response = await fetch(`/api/os/${osId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status, 
                    priority,
                    pending_reason,
                    attachment_url,
                    completed_at, 
                    execution_notes, 
                    materials_used, 
                    contrato_id
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            showToast('Ordem de Serviço atualizada com sucesso!', 'success');

            // Atualiza a Timeline imediatamente após salvar sem precisar recarregar a tela inteira
            carregarHistoricoOS();

        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    carregarDetalhesOS();
}); 