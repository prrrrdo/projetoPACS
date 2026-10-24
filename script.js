document.addEventListener('DOMContentLoaded', () => {
    // Elementos - Formulario de Login
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');

    // Elementos - Modais
    const modalForgot = document.getElementById('modalForgot');
    const modalRegister = document.getElementById('modalRegister');
    const btnOpenForgot = document.getElementById('btnOpenForgot');
    const btnOpenRegister = document.getElementById('btnOpenRegister');
    const btnsCloseForgot = document.querySelectorAll('.btnCloseForgot');
    const btnsCloseRegister = document.querySelectorAll('.btnCloseRegister');

    // Elementos - Formularios Secundarios
    const forgotForm = document.getElementById('forgotForm');
    const registerForm = document.getElementById('registerForm');
    const toastContainer = document.getElementById('toastContainer');

    // Funções de Controle de Modais
    const openModal = (modal) => modal.classList.add('active');
    const closeModal = (modal) => modal.classList.remove('active');

    btnOpenForgot.addEventListener('click', () => openModal(modalForgot));
    btnOpenRegister.addEventListener('click', () => openModal(modalRegister));

    btnsCloseForgot.forEach(btn => btn.addEventListener('click', () => closeModal(modalForgot)));
    btnsCloseRegister.forEach(btn => btn.addEventListener('click', () => closeModal(modalRegister)));

    // Fechar ao clicar fora do card do modal
    [modalForgot, modalRegister].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Sistema de Toasts/Notificações
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

    // Submit - Form de Login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();

        if (username) {
            showToast(`Autenticando usuário ${username}...`, 'success');
            // Integração futura com o backend/API (NestJS) virá aqui
        }
    });

    // Submit - Esqueci Minha Senha
    forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        closeModal(modalForgot);
        showToast('Instruções enviadas para o e-mail/matrícula fornecido.', 'success');
        forgotForm.reset();
    });

    // Submit - Efetuar Cadastro
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pass = document.getElementById('regPass').value;
        const confirm = document.getElementById('regPassConfirm').value;

        if (pass !== confirm) {
            showToast('As senhas informadas não coincidem!', 'error');
            return;
        }

        closeModal(modalRegister);
        showToast('Solicitação de cadastro enviada para aprovação do administrador.', 'success');
        registerForm.reset();
    });
});