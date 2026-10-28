document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const userInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const btnOpenForgot = document.getElementById('btnOpenForgot');
    const toastContainer = document.getElementById('toastContainer');
  
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      if (toastContainer) {
        toastContainer.appendChild(toast);
      } else {
        document.body.appendChild(toast);
      }
  
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }
  
    // --- 1. CARREGAR DADOS SALVOS ("Lembrar neste dispositivo") ---
    const savedUser = localStorage.getItem('sigmah_saved_user');
    if (savedUser && userInput) {
      userInput.value = savedUser;
      if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
  
    // --- 2. SUBMIT DE LOGIN ---
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = userInput.value.trim();
        const senha = passwordInput.value;
  
        // Gerencia o "Lembrar neste dispositivo"
        if (rememberMeCheckbox && rememberMeCheckbox.checked) {
          localStorage.setItem('sigmah_saved_user', identifier);
        } else {
          localStorage.removeItem('sigmah_saved_user');
        }
  
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
          
          // Salva os dados do usuário logado no navegador
          localStorage.setItem('sigmah_user', JSON.stringify(data.user));
  
          // Redireciona de acordo com o perfil (Role)
          setTimeout(() => {
              if (data.user.role === 'manutencao') {
                window.location.href = 'manutencao.html';
              } else {
                window.location.href = 'requisitante.html';
              }
            }, 1000);
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    }
  
    // --- 3. ESQUECI MINHA SENHA (Aviso institucional) ---
    if (btnOpenForgot) {
      btnOpenForgot.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Para recuperação de senha, entre em contato com o administrador do sistema: felipe.prado@portoalegre.rs.gov.br');
      });
    }
  });