document.addEventListener('DOMContentLoaded', async () => {
    const toastContainer = document.getElementById('toastContainer');
    const osUpdateForm = document.getElementById('osUpdateForm');
    const btnVoltar = document.getElementById('btnVoltar');

    const urlParams = new URLSearchParams(window.location.search);
    const osId = urlParams.get('id');

    if (!osId) {
        alert('Nenhuma Ordem de Serviço selecionada.');
        window.location.href = 'manutencao.html';
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

    // --- CARREGAR CONTRATOS NO SELECT ---
    async function carregarContratosNoSelect(contratoAtualId) {
        try {
            const response = await fetch('http://localhost:3000/api/contratos');
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

    // --- CARREGAR DADOS DA OS ---
    async function carregarDetalhesOS() {
        try {
            const response = await fetch(`http://localhost:3000/api/os/${osId}`);
            if (!response.ok) throw new Error('OS não encontrada.');

            const os = await response.json();
            demandIdGlobal = os.demand_id;

            btnVoltar.onclick = () => {
                window.location.href = `detalhes-demanda.html?id=${os.demand_id}`;
            };

            document.getElementById('osTitle').textContent = `Ordem de Serviço #OS-${os.id} (Demanda #${os.demand_id})`;
            document.getElementById('infoSpecialty').textContent = os.specialty;
            document.getElementById('infoCreatedAt').textContent = new Date(os.created_at).toLocaleString('pt-BR');
            document.getElementById('infoLocation').textContent = os.location;
            document.getElementById('infoSolicitante').textContent = `${os.solicitante} (${os.unidade} / ${os.setor || 'N/A'})`;
            document.getElementById('infoInstructions').textContent = os.instructions || 'Nenhuma instrução específica.';

            document.getElementById('osStatus').value = os.status || 'Aberta';
            document.getElementById('osCompletedAt').value = formatarParaDatetimeLocal(os.completed_at);
            document.getElementById('osExecutionNotes').value = os.execution_notes || '';
            document.getElementById('osMaterials').value = os.materials_used || '';

            // Carrega os contratos e seleciona o da OS atual
            await carregarContratosNoSelect(os.contrato_id);

        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar detalhes da OS.', 'error');
        }
    }

    // --- SALVAR ATUALIZAÇÕES DA OS ---
    osUpdateForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const status = document.getElementById('osStatus').value;
        const completed_at = document.getElementById('osCompletedAt').value;
        const execution_notes = document.getElementById('osExecutionNotes').value.trim();
        const materials_used = document.getElementById('osMaterials').value.trim();
        const contrato_id = document.getElementById('osContratoSelect') ? document.getElementById('osContratoSelect').value : null;

        try {
            const response = await fetch(`http://localhost:3000/api/os/${osId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, completed_at, execution_notes, materials_used, contrato_id })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            showToast('Ordem de Serviço atualizada com sucesso!', 'success');

            setTimeout(() => {
                if (demandIdGlobal) {
                    window.location.href = `detalhes-demanda.html?id=${demandIdGlobal}`;
                }
            }, 1500);

        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    carregarDetalhesOS();
});