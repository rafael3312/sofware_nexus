// frontend/js/registro.js

document.addEventListener('DOMContentLoaded', () => {
    const registroForm = document.getElementById('registroForm');

    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Obtener valores
        const razon_social = document.getElementById('razon_social').value.trim();
        const numero_documento = document.getElementById('numero_documento').value.trim();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        const submitBtn = registroForm.querySelector('button[type="submit"]');
        const errorMsg = document.getElementById('passwordError');

        // 2. Validaciones Frontend
        if (password !== confirmPassword) {
            errorMsg.classList.remove('d-none');
            return;
        } else {
            errorMsg.classList.add('d-none');
        }

        if (password.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        // 3. Preparar UI
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';

        try {
            // 4. Enviar al Backend
            const response = await fetch('http://localhost:3000/api/auth/register-owner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    razon_social, 
                    numero_documento, 
                    username, 
                    email, 
                    password 
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('¡Registro exitoso! Bienvenido a Nexus.');
                window.location.href = 'login.html';
            } else {
                alert(data.error || 'Error al registrar');
            }

        } catch (error) {
            console.error('Error:', error);
            alert('Error de conexión con el servidor.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
});