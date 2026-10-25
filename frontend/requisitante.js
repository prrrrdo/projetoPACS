document.addEventListener('DOMContentLoaded', async () => {
  const toastContainer = document.getElementById('toastContainer');
  const demandsTableBody = document.getElementById('demandsTableBody');
  const demandForm = document.getElementById('demandForm');

  // Recupera o usuário salvo no localStorage após o login
  const storedUser = localStorage.getItem('sigmah_user');

  if (!storedUser) {
    // Se não estiver logado, expulsa de volta para a tela de login
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(storedUser);

  // Preenche os dados do usuário na interface
  document.getElementById('headerUserName').textContent = `Olá, ${user.nome}`;
  document.getElementById('reqName').value = user.nome;
  document.getElementById('reqMatricula').value = user.matricula;
  document.getElementById('reqRamal').value = user.ramal || 'N/A';
  document.getElementById('reqUnit').value = user.unidade;
  document.getElementById('reqDepartment').value = user.setor || 'N/A';

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

  // --- BUSCAR DEMANDAS DO BANCO PARA ESTE USUÁRIO ---
  async function carregarDemandas() {
    try {
      const response = await fetch(`http://localhost:3000/api/demands/${user.id}`);
      const demands = await response.json();

      if (demands.length === 0) {
        demandsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nenhuma demanda registrada recentemente.</td></tr>`;
        return;
      }

      // Restauração das tags HTML <tr> e <td> para a tabela funcionar corretamente
      demandsTableBody.innerHTML = demands.map(d => `
        <tr>
          <td><strong>#${d.id}</strong></td>
          <td>${d.location}</td>
          <td>${d.description}</td>
          <td>${new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
          <td><span style="color: var(--primary); font-weight: 600;">${d.status}</span></td>
        </tr>
      `).join('');

    } catch (error) {
      console.error('Erro ao buscar demandas:', error);
      demandsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="color: #ef4444;">Erro ao conectar com o servidor (O backend está rodando?).</td></tr>`;
    }
  }

  // Executa ao carregar a página
  carregarDemandas();

  // --- ENVIAR NOVA DEMANDA PARA A API ---
  demandForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const location = document.getElementById('demandLocation').value.trim();
    const description = document.getElementById('demandDescription').value.trim();

    if (location && description) {
      try {
        const response = await fetch('http://localhost:3000/api/demands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, location, description })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao registrar demanda.');
        }

        showToast('Demanda enviada com sucesso para a equipe de manutenção!', 'success');
        demandForm.reset();
        
        // Recarrega a tabela para exibir a nova demanda
        carregarDemandas();

      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  });

  // Botão Sair / Logout
  document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('sigmah_user');
    window.location.href = 'login.html';
  });
});