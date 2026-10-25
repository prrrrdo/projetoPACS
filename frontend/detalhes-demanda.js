document.addEventListener('DOMContentLoaded', async () => {
  const toastContainer = document.getElementById('toastContainer');
  const osForm = document.getElementById('osForm');
  const osTableBody = document.getElementById('osTableBody');

  const urlParams = new URLSearchParams(window.location.search);
  const demandId = urlParams.get('id');

  if (!demandId) {
    alert('Nenhuma demanda selecionada.');
    window.location.href = 'manutencao.html';
    return;
  }

  let dadosDemandaAtual = {};

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

  // --- CARREGAR CONTRATOS NO SELECT DA NOVA OS ---
  async function carregarContratosSelect() {
    try {
      const response = await fetch('http://localhost:3000/api/contratos');
      const contratos = await response.json();
      const select = document.getElementById('osContrato');

      if (!select) return;

      contratos.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = `${c.empresa_nome} - Contrato: ${c.numero_contrato}`;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    }
  }

  // --- 1. BUSCAR DADOS DA DEMANDA ---
  async function carregarDetalhesDemanda() {
    try {
      const response = await fetch(`http://localhost:3000/api/demands/${demandId}`);
      if (!response.ok) throw new Error('Demanda não encontrada.');
      
      const d = await response.json();
      dadosDemandaAtual = d;

      document.getElementById('demandTitle').textContent = `Demanda Protocolo #${d.id}`;
      document.getElementById('infoNome').textContent = d.nome || 'Não informado';
      document.getElementById('infoMatricula').textContent = d.matricula || 'Não informada';
      document.getElementById('infoCargo').textContent = d.cargo || 'N/A';
      document.getElementById('infoRamal').textContent = d.ramal || 'N/A';
      document.getElementById('infoLocalSetor').textContent = `${d.unidade || 'N/A'} / ${d.setor || 'N/A'}`;
      document.getElementById('infoLocation').textContent = d.location || 'Não informado';
      document.getElementById('infoDescription').textContent = d.description || 'Sem descrição';

    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar detalhes da demanda.', 'error');
    }
  }

  // --- 2. BUSCAR ORDENS DE SERVIÇO (OS) DESTA DEMANDA ---
  async function carregarOSs() {
    try {
      const response = await fetch(`http://localhost:3000/api/demands/${demandId}/os`);
      const oss = await response.json();

      if (oss.length === 0) {
        osTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhuma Ordem de Serviço gerada para esta demanda ainda.</td></tr>`;
        return;
      }

      osTableBody.innerHTML = oss.map(os => `
        <tr>
          <td><a href="detalhes-os.html?id=${os.id}" style="color: var(--primary); font-weight: bold; text-decoration: none;">#OS-${os.id}</a></td>
          <td><span style="font-weight: 600; color: var(--primary);">${os.specialty}</span></td>
          <td>${os.instructions || 'Nenhuma instrução adicional.'}</td>
          <td>${new Date(os.created_at).toLocaleString('pt-BR')}</td>
          <td>${os.status}</td>
          <td style="display: flex; gap: 8px;">
            <a href="detalhes-os.html?id=${os.id}" class="btn-ghost-sm" style="padding: 6px 12px; text-decoration: none; background: rgba(255,255,255,0.05);">Editar OS</a>
            <button onclick='imprimirOS(${JSON.stringify(os)})' class="btn-ghost-sm" style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
              Imprimir
            </button>
          </td>
        </tr>
      `).join('');

    } catch (error) {
      console.error(error);
      osTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Erro ao carregar Ordens de Serviço.</td></tr>`;
    }
  }

  // --- 3. CRIAR NOVA OS ---
  osForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const specialty = document.getElementById('osSpecialty').value;
    const instructions = document.getElementById('osInstructions').value.trim();
    const contrato_id = document.getElementById('osContrato').value;

    try {
      const response = await fetch(`http://localhost:3000/api/demands/${demandId}/os`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty, instructions, contrato_id })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showToast('Ordem de Serviço gerada com sucesso!', 'success');
      osForm.reset();
      carregarOSs();

    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // --- 4. FUNÇÃO DE IMPRESSÃO ---
  window.imprimirOS = function(os) {
    document.getElementById('pDemandId').textContent = dadosDemandaAtual.id;
    document.getElementById('pDemandDate').textContent = new Date(dadosDemandaAtual.created_at).toLocaleDateString('pt-BR');
    document.getElementById('pLocation').textContent = dadosDemandaAtual.location;
    document.getElementById('pDescription').textContent = dadosDemandaAtual.description;

    document.getElementById('pNome').textContent = dadosDemandaAtual.nome;
    document.getElementById('pMatricula').textContent = dadosDemandaAtual.matricula;
    document.getElementById('pCargo').textContent = dadosDemandaAtual.cargo || 'N/A';
    document.getElementById('pUnidadeSetor').textContent = `${dadosDemandaAtual.unidade} / ${dadosDemandaAtual.setor || 'N/A'}`;
    document.getElementById('pRamal').textContent = dadosDemandaAtual.ramal || 'N/A';

    document.getElementById('pOsId').textContent = `OS-${os.id}`;
    document.getElementById('pSpecialty').textContent = os.specialty;
    document.getElementById('pInstructions').textContent = os.instructions || 'Nenhuma instrução específica informada.';

    window.print();
  };

  carregarDetalhesDemanda();
  carregarContratosSelect();
  carregarOSs();
});