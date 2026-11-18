document.addEventListener('DOMContentLoaded', async () => {
  const toastContainer = document.getElementById('toastContainer');
  const demandsTableBody = document.getElementById('demandsTableBody');
  const demandForm = document.getElementById('demandForm');

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
    if (user.role !== 'requisitante') {
      window.location.replace(user.role === 'manutencao' ? '/manutencao.html' : '/login.html');
      return;
    }
  } catch (_) {
    window.location.replace('/login.html');
    return;
  }

  document.getElementById('headerUserName').textContent = `Olá, ${user.nome}`;
  document.getElementById('reqName').value = user.nome;
  document.getElementById('reqMatricula').value = user.matricula;
  document.getElementById('reqRamal').value = user.ramal || 'N/A';
  document.getElementById('reqUnit').value = user.unidade;
  document.getElementById('reqDepartment').value = user.setor || 'N/A';

  async function carregarDemandas() {
    try {
      const response = await fetch(`/api/demands/user/${user.id}`);
      const demands = await response.json();
      if (!response.ok) throw new Error(demands.error || 'Erro ao consultar solicitações.');
      if (!demands.length) {
        demandsTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma demanda registrada recentemente.</td></tr>';
        return;
      }
      demandsTableBody.innerHTML = demands.map(d => `
        <tr><td><strong>#${d.id}</strong></td><td>${d.location}</td><td>${d.description}</td>
        <td>${new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
        <td><span style="color: var(--primary); font-weight: 600;">${d.status}</span></td></tr>`).join('');
    } catch (error) {
      console.error(error);
      demandsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">${error.message}</td></tr>`;
    }
  }

  carregarDemandas();

  demandForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const location = document.getElementById('demandLocation').value.trim();
    const description = document.getElementById('demandDescription').value.trim();
    if (!location || !description) return;
    try {
      const response = await fetch('/api/demands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, description })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao registrar demanda.');
      showToast('Demanda enviada com sucesso para a equipe de manutenção!', 'success');
      demandForm.reset();
      carregarDemandas();
    } catch (error) { showToast(error.message, 'error'); }
  });

  document.getElementById('btnLogout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('sigmah_user');
    window.location.replace('/login.html');
  });
});