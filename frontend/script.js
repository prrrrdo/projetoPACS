document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
 
    // Modais
    const modalForgot = document.getElementById('modalForgot');
    const modalRegister = document.getElementById('modalRegister');
    const btnOpenForgot = document.getElementById('btnOpenForgot');
    const btnOpenRegister = document.getElementById('btnOpenRegister');
    const btnsCloseForgot = document.querySelectorAll('.btnCloseForgot');
    const btnsCloseRegister = document.querySelectorAll('.btnCloseRegister');
 
    const forgotForm = document.getElementById('forgotForm');
    const registerForm = document.getElementById('registerForm');
    const toastContainer = document.getElementById('toastContainer');
 
    const openModal = (modal) => modal.classList.add('active');
    const closeModal = (modal) => modal.classList.remove('active');
 
    btnOpenForgot.addEventListener('click', () => openModal(modalForgot));
    btnOpenRegister.addEventListener('click', () => openModal(modalRegister));
 
    btnsCloseForgot.forEach(btn => btn.addEventListener('click', () => closeModal(modalForgot)));
    btnsCloseRegister.forEach(btn => btn.addEventListener('click', () => closeModal(modalRegister)));
 
    [modalForgot, modalRegister].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });
 
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toastContainer.appendChild(toast);
 
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }
 
    // --- SUBMIT DE LOGIN (Consumindo a API) ---
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('username').value.trim();
      const senha = passwordInput.value;
 
      try {
        const response = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, senha })
        });
 
        const data = await response.json();
 
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao realizar login.');
        }
 
        showToast('Login realizado com sucesso! Redirecionando...', 'success');
        
        // Salva os dados do usuário logado no navegador para usar na próxima página
        localStorage.setItem('sigmah_user', JSON.stringify(data.user));
 
        // Redireciona de acordo com o perfil (Role)
        setTimeout(() => {
            if (data.user.role === 'manutencao') {
              window.location.href = 'manutencao.html'; // Painel Técnico
            } else {
              window.location.href = 'requisitante.html'; // Painel de Chamados
            }
          }, 1000);
      } catch (error) {
        // Bloco catch adicionado aqui para tratar erros de login
        showToast(error.message, 'error');
      }
    });
 
    // Esqueci minha senha (mantido simulado por enquanto)
    forgotForm.addEventListener('submit', (e) => {
      e.preventDefault();
      closeModal(modalForgot);
      showToast('Instruções enviadas para o e-mail/matrícula fornecido.', 'success');
      forgotForm.reset();
    });
 
    // --- SUBMIT DE CADASTRO (Consumindo a API) ---
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
});