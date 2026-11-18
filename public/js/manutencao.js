document.addEventListener('DOMContentLoaded', async () => {
    const toastContainer = document.getElementById('toastContainer');
    const maintenanceTableBody = document.getElementById('maintenanceTableBody');
  
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      if (toastContainer) toastContainer.appendChild(toast);
      setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 4000);
    }
  
    let user;
    try {
      const response = await fetch('/api/me');
      if (!response.ok) throw new Error('Sessão não autenticada.');
      ({ user } = await response.json());
      if (user.role !== 'manutencao') {
        window.location.replace(user.role === 'requisitante' ? '/requisitante.html' : '/login.html');
        return;
      }
    } catch (_) {
      window.location.replace('/login.html');
      return;
    }
  
    document.getElementById('headerUserName').textContent = `Técnico: ${user.nome}`;
  
    async function carregarTodasDemandas() {
      try {
        const response = await fetch('/api/demands');
        const demands = await response.json();
        if (!response.ok) throw new Error(demands.error || 'Erro ao carregar demandas.');
        if (!demands.length) {
          maintenanceTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma demanda registrada no sistema.</td></tr>';
          return;
        }
        maintenanceTableBody.innerHTML = demands.map(d => `
          <tr><td><a href="/detalhes-demanda.html?id=${d.id}" style="color: var(--primary); font-weight: bold; text-decoration: none;">#${d.id}</a></td>
          <td>${d.solicitante || 'Desconhecido'} (${d.unidade || 'N/A'})</td><td>${d.location}</td><td>${d.description}</td>
          <td>${new Date(d.created_at).toLocaleDateString('pt-BR')}</td><td><span style="font-weight: 600;">${d.status}</span></td></tr>`).join('');
      } catch (error) {
        console.error(error);
        maintenanceTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="color:#ef4444;">${error.message}</td></tr>`;
      }
    }
  
    window.atualizarStatus = async (demandId, novoStatus) => {
      try {
        const response = await fetch(`/api/demands/${demandId}/status`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: novoStatus })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao atualizar status.');
        showToast(`Demanda #${demandId} atualizada para "${novoStatus}"!`, 'success');
        carregarTodasDemandas();
      } catch (error) { showToast(error.message, 'error'); }
    };
  
    carregarTodasDemandas();
    document.getElementById('btnLogout').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      localStorage.removeItem('sigmah_user');
      window.location.replace('/login.html');
    });
  });
  