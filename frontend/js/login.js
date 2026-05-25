// frontend/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verificar si ya hay sesión activa
    const token = localStorage.getItem('token');
    if (token) {
        // Si ya tiene token, lo mandamos directo al dashboard
        window.location.href = 'admin.html';
        return;
    }

    // 2. Manejar el envío del formulario
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Referencias a los inputs
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        // Feedback visual de carga
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...';

        const credentials = {
            username: usernameInput.value.trim(),
            password: passwordInput.value.trim()
        };

        try {
            // Petición al Backend
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();

            if (response.ok) {
                // --- ÉXITO ---
                // Guardamos el token y el objeto usuario completo
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Redirección al "Cascarón Principal"
                window.location.href = 'admin.html';
            } else {
                // --- ERROR DE CREDENCIALES ---
                alert(data.error || 'Usuario o contraseña incorrectos');
            }

        } catch (error) {
            console.error('Error de conexión:', error);
            alert('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
        } finally {
            // Restaurar botón
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    // 3. (Extra) Lógica para ver/ocultar contraseña
    const togglePassword = document.querySelector('.toggle-password');
    if(togglePassword) {
        togglePassword.addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }
});