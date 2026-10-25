document.addEventListener('DOMContentLoaded', async () => {
    const toastContainer = document.getElementById('toastContainer');
    const maintenanceTableBody = document.getElementById('maintenanceTableBody');
  
    const storedUser = localStorage.getItem('sigmah_user');
  
    if (!storedUser) {
      window.location.href = 'login.html';
      return;
    }
  
    const user = JSON.parse(storedUser);
  
    // Segurança extra: se não for manutenção, expulsa de volta
    if (user.role !== 'manutencao') {
      window.location.href = 'requisitante.html';
      return;
    }
  
    document.getElementById('headerUserName').textContent = `Técnico: ${user.nome}`;
  
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
  
    // --- BUSCAR TODAS AS DEMANDAS DO BANCO PARA A MANUTENÇÃO ---
    async function carregarTodasDemandas() {
      try {
        const response = await fetch('http://localhost:3000/api/demands');
        const demands = await response.json();
  
        if (demands.length === 0) {
          maintenanceTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Nenhuma demanda registrada no sistema.</td></tr>`;
          return;
        }
  
        maintenanceTableBody.innerHTML = demands.map(d => `
          <tr>
            <td><strong>#${d.id}</strong></td>
            <td>${d.solicitante || 'Desconhecido'} (${d.unidade || 'N/A'})</td>
            <td>${d.location}</td>
            <td>${d.description}</td>
            <td>${new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
            <td>
              <span style="font-weight: 600; color: ${d.status === 'Concluído' ? '#10b981' : d.status === 'Em Andamento' ? '#f59e0b' : '#06b6d4'};">
                ${d.status}
              </span>
            </td>
            <td>
              <select onchange="atualizarStatus(${d.id}, this.value)" style="padding: 4px; border-radius: 4px; background: var(--input-bg); color: var(--text-main); border: 1px solid var(--border);">
                <option value="" disabled selected>Alterar status...</option>
                <option value="Pendente">Pendente</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
              </select>
            </td>
          </tr>
        `).join('');
  
      } catch (error) {
        console.error('Erro ao carregar demandas:', error);
        maintenanceTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="color: #ef4444;">Erro ao conectar com o servidor.</td></tr>`;
      }
    }
  
    // Função global para atualizar o status via select
    window.atualizarStatus = async function(demandId, novoStatus) {
      try {
        const response = await fetch(`http://localhost:3000/api/demands/${demandId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: novoStatus })
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao atualizar status.');
        }
  
        showToast(`Demanda #${demandId} atualizada para "${novoStatus}"!`, 'success');
        carregarTodasDemandas();
  
      } catch (error) {
        showToast(error.message, 'error');
      }
    };
  
    carregarTodasDemandas();
  
    document.getElementById('btnLogout').addEventListener('click', () => {
      localStorage.removeItem('sigmah_user');
      window.location.href = 'login.html';
    });
  });