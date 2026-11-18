document.addEventListener('DOMContentLoaded', async () => {
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
    (toastContainer || document.body).appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 4000);
  }

  const savedUser = localStorage.getItem('sigmah_saved_user');
  if (savedUser && userInput) {
    userInput.value = savedUser;
    if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
  }

  // Se já houver uma sessão válida, encaminha para a página correspondente.
  try {
    const me = await fetch('/api/me');
    if (me.ok) {
      const data = await me.json();
      window.location.replace(data.user.role === 'manutencao' ? '/manutencao.html' : '/requisitante.html');
      return;
    }
  } catch (_) {}

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = userInput.value.trim();
      const senha = passwordInput.value;

      if (rememberMeCheckbox && rememberMeCheckbox.checked) localStorage.setItem('sigmah_saved_user', identifier);
      else localStorage.removeItem('sigmah_saved_user');

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ identifier, senha })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao realizar login.');

        // Não armazenar identidade/autorização no localStorage: o cookie da sessão é HttpOnly.
        localStorage.removeItem('sigmah_user');
        showToast('Login realizado com sucesso! Redirecionando...', 'success');
        setTimeout(() => {
          window.location.href = data.user.role === 'manutencao' ? '/manutencao.html' : '/requisitante.html';
        }, 500);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  if (btnOpenForgot) {
    btnOpenForgot.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Para recuperação de senha, entre em contato com o administrador do sistema: felipe.prado@portoalegre.rs.gov.br');
    });
  }
});
