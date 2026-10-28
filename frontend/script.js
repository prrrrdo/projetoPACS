document.addEventListener('DOMContentLoaded', () => {
  // Modais de Cadastro
  const modalRegister = document.getElementById('modalRegister');
  const btnOpenRegister = document.getElementById('btnOpenRegister');
  const btnsCloseRegister = document.querySelectorAll('.btnCloseRegister');
  const registerForm = document.getElementById('registerForm');
  const toastContainer = document.getElementById('toastContainer');

  const openModal = (modal) => modal.classList.add('active');
  const closeModal = (modal) => modal.classList.remove('active');

  if (btnOpenRegister) btnOpenRegister.addEventListener('click', () => openModal(modalRegister));
  btnsCloseRegister.forEach(btn => btn.addEventListener('click', () => closeModal(modalRegister)));

  if (modalRegister) {
    modalRegister.addEventListener('click', (e) => {
      if (e.target === modalRegister) closeModal(modalRegister);
    });
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    if (toastContainer) toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- SUBMIT DE CADASTRO ---
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nome = document.getElementById('regFullName').value.trim();
      const matricula = document.getElementById('regMatricula').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const cargo = document.getElementById('regPosition').value;
      const unidade = document.getElementById('regUnit').value;
      const setor = document.getElementById('regDepartment').value;
      const ramal = document.getElementById('regRamal').value.trim();
      const senha = document.getElementById('regPass').value;
      const confirm = document.getElementById('regPassConfirm').value;

      if (senha !== confirm) {
        showToast('As senhas informadas não coincidem!', 'error');
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, matricula, email, senha, cargo, unidade, setor, ramal })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao cadastrar usuário.');
        }

        closeModal(modalRegister);
        showToast('Cadastro realizado com sucesso! Faça login para continuar.', 'success');
        registerForm.reset();

      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }
});